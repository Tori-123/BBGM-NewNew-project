from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, joinedload
from starlette.exceptions import HTTPException as StarletteHTTPException

from deps import get_current_user, get_db
from errors import ApiError, StorageError, forbidden, validation_error
from avatars import (
    ALLOWED_TYPES,
    MAX_POST_IMAGE_BYTES,
    MAX_POST_IMAGES,
    dump_images,
    normalize_avatar,
    parse_images,
    save_post_image,
)
from models import Comment, Post, User, to_iso
from schemas import (
    CATEGORIES,
    CATEGORY_MESSAGE,
    NEWSPAPER_CATEGORIES,
    STAFF_ROLES,
    AuthorPublic,
    CommentFloor,
    CommentList,
    CommentReply,
    CreateCommentBody,
    CreatePostBody,
    PostDetail,
    PostList,
    PostSummary,
    PromoteBody,
    ReplyPreview,
)
from store import create_comment, create_post_with_audit
from validate import parse_optional_category, parse_page, parse_page_size, parse_starts_at, parse_uuid

router = APIRouter()


def _author_public(user: User) -> AuthorPublic:
    return AuthorPublic(
        id=user.id,
        display_name=user.display_name,
        avatar=normalize_avatar(getattr(user, "avatar", None)),
    )


def _summary(
    post: Post,
    *,
    reply_count: int = 0,
    reply_preview: list[ReplyPreview] | None = None,
    include_images: bool = False,
) -> PostSummary:
    images = parse_images(getattr(post, "images", None)) if include_images and post.category == "community" else []
    return PostSummary(
        id=post.id,
        title=post.title,
        excerpt=post.excerpt,
        category=post.category,
        is_activity=post.is_activity,
        starts_at=to_iso(post.starts_at) if post.starts_at else None,
        location=post.location,
        status=post.status,
        created_at=to_iso(post.created_at),
        updated_at=to_iso(post.updated_at),
        author=_author_public(post.author),
        reply_count=reply_count,
        reply_preview=reply_preview or [],
        images=images,
    )


def _detail(post: Post) -> dict:
    return PostDetail(
        **_summary(post, include_images=post.category == "community").model_dump(),
        body=post.body,
    ).model_dump()


def _published_post(db: Session, post_id: str) -> Post:
    try:
        post = db.scalar(
            select(Post).options(joinedload(Post.author)).where(Post.id == post_id, Post.status == "published")
        )
    except SQLAlchemyError as exc:
        raise StorageError() from exc
    if post is None:
        raise ApiError(404, "not_found", "Post not found.")
    return post


def _require_community(post: Post) -> None:
    if post.category != "community":
        raise validation_error(
            [{"field": "category", "message": "Comments are only available on community posts."}]
        )


def _activity_field_errors(is_activity: bool, starts_at: str | None, location: str | None) -> list[dict[str, str]]:
    fields: list[dict[str, str]] = []
    if is_activity:
        if not starts_at:
            fields.append(
                {"field": "starts_at", "message": "Start time is required when this post is an activity."}
            )
        else:
            try:
                parse_starts_at(starts_at)
            except ApiError as exc:
                if exc.code == "validation_error":
                    fields.extend(exc.fields)
                else:
                    raise
        place = (location or "").strip()
        if not place or len(place) > 200:
            fields.append(
                {
                    "field": "location",
                    "message": "Location is required when this post is an activity.",
                }
            )
    else:
        if starts_at is not None:
            fields.append(
                {
                    "field": "starts_at",
                    "message": "Start time must be empty when this post is not an activity.",
                }
            )
        if location is not None:
            fields.append(
                {
                    "field": "location",
                    "message": "Location must be empty when this post is not an activity.",
                }
            )
    return fields


def _post_field_errors(body: CreatePostBody) -> list[dict[str, str]]:
    fields: list[dict[str, str]] = []
    title = body.title.strip()
    if not title or len(title) > 120:
        fields.append({"field": "title", "message": "Title must be 1–120 characters."})
    text = body.body.strip()
    if not text or len(text) > 20000:
        fields.append({"field": "body", "message": "Body must be 1–20000 characters."})
    if body.category not in CATEGORIES:
        fields.append({"field": "category", "message": CATEGORY_MESSAGE})
    if body.category == "community" and body.is_activity:
        fields.append({"field": "is_activity", "message": "Community posts cannot be activities."})
    fields.extend(_activity_field_errors(body.is_activity, body.starts_at, body.location))
    return fields


def _list_posts(db: Session, *, page: int, page_size: int, category: str | None, author_id: str | None) -> dict:
    filters = [Post.status == "published"]
    if category is not None:
        filters.append(Post.category == category)
    elif author_id is None:
        filters.append(Post.category.in_(NEWSPAPER_CATEGORIES))
    if author_id is not None:
        filters.append(Post.author_id == author_id)
    try:
        total = db.scalar(select(func.count()).select_from(Post).where(*filters)) or 0
        rows = db.scalars(
            select(Post)
            .options(joinedload(Post.author))
            .where(*filters)
            .order_by(Post.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
    except SQLAlchemyError as exc:
        raise StorageError() from exc
    previews = _community_previews(db, rows) if category == "community" else {}
    include_images = category == "community"
    return PostList(
        items=[
            _summary(
                post,
                reply_count=previews.get(post.id, (0, []))[0],
                reply_preview=previews.get(post.id, (0, []))[1],
                include_images=include_images,
            )
            for post in rows
        ],
        page=page,
        page_size=page_size,
        total=total,
    ).model_dump()


def _community_previews(db: Session, posts: list[Post]) -> dict[str, tuple[int, list[ReplyPreview]]]:
    ids = [post.id for post in posts if post.category == "community"]
    if not ids:
        return {}
    try:
        floors = db.scalars(
            select(Comment)
            .options(joinedload(Comment.author))
            .where(Comment.post_id.in_(ids), Comment.parent_id.is_(None))
            .order_by(Comment.created_at.asc())
        ).all()
    except SQLAlchemyError as exc:
        raise StorageError() from exc
    grouped: dict[str, list[Comment]] = {}
    for floor in floors:
        grouped.setdefault(floor.post_id, []).append(floor)
    result: dict[str, tuple[int, list[ReplyPreview]]] = {}
    for post_id, items in grouped.items():
        result[post_id] = (
            len(items),
            [
                ReplyPreview(
                    id=item.id,
                    body=item.body,
                    created_at=to_iso(item.created_at),
                    author=_author_public(item.author),
                )
                for item in items[:4]
            ],
        )
    return result


def _floor_payload(comment: Comment, floor: int, replies: list[Comment]) -> dict:
    return CommentFloor(
        id=comment.id,
        body=comment.body,
        parent_id=None,
        floor=floor,
        created_at=to_iso(comment.created_at),
        author=_author_public(comment.author),
        replies=[
            CommentReply(
                id=reply.id,
                body=reply.body,
                parent_id=reply.parent_id or comment.id,
                created_at=to_iso(reply.created_at),
                author=_author_public(reply.author),
            )
            for reply in replies
        ],
    ).model_dump()


def _reply_payload(comment: Comment) -> dict:
    return CommentReply(
        id=comment.id,
        body=comment.body,
        parent_id=comment.parent_id or "",
        created_at=to_iso(comment.created_at),
        author=_author_public(comment.author),
    ).model_dump()


@router.get("/posts")
def list_posts(
    db: Session = Depends(get_db),
    category: str | None = Query(default=None),
    page: str | None = Query(default=None),
    page_size: str | None = Query(default=None),
):
    parsed_page = parse_page(page)
    parsed_size = parse_page_size(page_size)
    parsed_category = parse_optional_category(category)
    return _list_posts(db, page=parsed_page, page_size=parsed_size, category=parsed_category, author_id=None)


@router.get("/posts/{post_id}/comments")
def list_comments(
    post_id: str,
    db: Session = Depends(get_db),
    page: str | None = Query(default=None),
    page_size: str | None = Query(default=None),
):
    post_id = parse_uuid(post_id)
    parsed_page = parse_page(page)
    parsed_size = parse_page_size(page_size)
    post = _published_post(db, post_id)
    _require_community(post)

    floor_filter = [Comment.post_id == post_id, Comment.parent_id.is_(None)]
    try:
        total = db.scalar(select(func.count()).select_from(Comment).where(*floor_filter)) or 0
        floors = db.scalars(
            select(Comment)
            .options(joinedload(Comment.author))
            .where(*floor_filter)
            .order_by(Comment.created_at.asc())
            .offset((parsed_page - 1) * parsed_size)
            .limit(parsed_size)
        ).all()
        floor_ids = [item.id for item in floors]
        replies = []
        if floor_ids:
            replies = db.scalars(
                select(Comment)
                .options(joinedload(Comment.author))
                .where(Comment.post_id == post_id, Comment.parent_id.in_(floor_ids))
                .order_by(Comment.created_at.asc())
            ).all()
    except SQLAlchemyError as exc:
        raise StorageError() from exc

    grouped: dict[str, list[Comment]] = {item.id: [] for item in floors}
    for reply in replies:
        grouped.setdefault(reply.parent_id or "", []).append(reply)

    start = (parsed_page - 1) * parsed_size
    items = [
        _floor_payload(floor, start + index + 1, grouped.get(floor.id, []))
        for index, floor in enumerate(floors)
    ]
    return CommentList(items=items, page=parsed_page, page_size=parsed_size, total=total).model_dump()


@router.post("/posts/{post_id}/comments", status_code=201)
def create_post_comment(
    post_id: str,
    body: CreateCommentBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post_id = parse_uuid(post_id)
    post = _published_post(db, post_id)
    _require_community(post)

    text = body.body.strip()
    fields: list[dict[str, str]] = []
    if not text or len(text) > 4000:
        fields.append({"field": "body", "message": "Body must be 1–4000 characters."})

    parent = None
    parent_id = body.parent_id
    if parent_id:
        parent_id = parse_uuid(parent_id, "parent_id")
        try:
            parent = db.scalar(select(Comment).where(Comment.id == parent_id, Comment.post_id == post_id))
        except SQLAlchemyError as exc:
            raise StorageError() from exc
        if parent is None:
            raise ApiError(404, "not_found", "Comment not found.")
        if parent.parent_id is not None:
            fields.append({"field": "parent_id", "message": "Replies must target a floor, not another reply."})

    if fields:
        raise validation_error(fields)

    try:
        comment = create_comment(
            db,
            post=post,
            author=user,
            body=text,
            parent_id=parent.id if parent else None,
        )
    except StorageError:
        raise ApiError(503, "storage_unavailable", "Could not save the comment. Try again in a moment.") from None

    if comment.parent_id:
        return JSONResponse(status_code=201, content=_reply_payload(comment))

    try:
        floor_total = db.scalar(
            select(func.count()).select_from(Comment).where(
                Comment.post_id == post_id,
                Comment.parent_id.is_(None),
            )
        ) or 1
    except SQLAlchemyError as exc:
        raise StorageError() from exc
    return JSONResponse(status_code=201, content=_floor_payload(comment, floor_total, []))


@router.post("/posts/{post_id}/promote", status_code=201)
def promote_post(
    post_id: str,
    body: PromoteBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role not in STAFF_ROLES:
        raise forbidden()

    post_id = parse_uuid(post_id)
    source = _published_post(db, post_id)
    if source.category != "community":
        raise validation_error(
            [{"field": "category", "message": "Only community posts can be promoted."}]
        )

    title = (body.title if body.title is not None else source.title).strip()
    text = (body.body if body.body is not None else source.body).strip()
    fields: list[dict[str, str]] = []
    if not title or len(title) > 120:
        fields.append({"field": "title", "message": "Title must be 1–120 characters."})
    if not text or len(text) > 20000:
        fields.append({"field": "body", "message": "Body must be 1–20000 characters."})
    if body.category not in NEWSPAPER_CATEGORIES:
        fields.append(
            {
                "field": "category",
                "message": "Must be one of: news, dorm_life, sports, events.",
            }
        )
    fields.extend(_activity_field_errors(body.is_activity, body.starts_at, body.location))
    if fields:
        raise validation_error(fields)

    starts_at = parse_starts_at(body.starts_at) if body.is_activity else None
    location = body.location.strip() if body.is_activity else None
    try:
        post = create_post_with_audit(
            db,
            author=user,
            title=title,
            body=text,
            category=body.category,
            is_activity=body.is_activity,
            starts_at=starts_at,
            location=location,
        )
    except StorageError:
        raise ApiError(
            503,
            "storage_unavailable",
            "Could not save the post. Try again in a moment.",
        ) from None
    return JSONResponse(status_code=201, content=_detail(post))


@router.post("/posts/{post_id}/images")
async def upload_post_image(
    post_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    file: UploadFile = File(...),
):
    post = _published_post(db, parse_uuid(post_id))
    if post.author_id != user.id:
        raise forbidden()
    if post.category != "community":
        raise validation_error(
            [{"field": "category", "message": "Images can only be added to community posts."}]
        )
    images = parse_images(getattr(post, "images", None))
    if len(images) >= MAX_POST_IMAGES:
        raise validation_error(
            [{"field": "file", "message": "Community posts can have at most 4 images."}]
        )
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    ext = ALLOWED_TYPES.get(content_type)
    if ext is None:
        raise validation_error(
            [{"field": "file", "message": "Image must be a jpeg, png, or webp file."}]
        )
    data = await file.read()
    if not data or len(data) > MAX_POST_IMAGE_BYTES:
        raise validation_error([{"field": "file", "message": "Image must be 1–2000000 bytes."}])
    try:
        images.append(save_post_image(post.id, ext, data))
        post.images = dump_images(images)
        db.flush()
    except OSError as exc:
        raise StorageError() from exc
    except SQLAlchemyError as exc:
        raise StorageError() from exc
    return _detail(post)


@router.get("/posts/{post_id}")
def get_post(post_id: str, db: Session = Depends(get_db)):
    return _detail(_published_post(db, parse_uuid(post_id)))


@router.post("/posts", status_code=201)
def create_post(
    body: CreatePostBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    fields = _post_field_errors(body)
    if fields:
        raise validation_error(fields)
    if user.role not in STAFF_ROLES and body.category != "community":
        raise forbidden("Students can only publish in community.")

    starts_at = parse_starts_at(body.starts_at) if body.is_activity else None
    location = body.location.strip() if body.is_activity else None
    try:
        post = create_post_with_audit(
            db,
            author=user,
            title=body.title.strip(),
            body=body.body.strip(),
            category=body.category,
            is_activity=body.is_activity,
            starts_at=starts_at,
            location=location,
        )
    except StorageError:
        raise ApiError(
            503,
            "storage_unavailable",
            "Could not save the post. Try again in a moment.",
        ) from None
    return JSONResponse(status_code=201, content=_detail(post))


@router.get("/me/posts")
def my_posts(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    page: str | None = Query(default=None),
    page_size: str | None = Query(default=None),
):
    parsed_page = parse_page(page)
    parsed_size = parse_page_size(page_size)
    return _list_posts(db, page=parsed_page, page_size=parsed_size, category=None, author_id=user.id)


@router.api_route("/posts/{post_id}", methods=["PATCH", "DELETE"])
def posts_mutating_not_allowed(post_id: str):
    raise StarletteHTTPException(status_code=405)


@router.api_route("/posts/{post_id}/comments/{comment_id}", methods=["PATCH", "DELETE"])
def comments_mutating_not_allowed(post_id: str, comment_id: str):
    raise StarletteHTTPException(status_code=405)
