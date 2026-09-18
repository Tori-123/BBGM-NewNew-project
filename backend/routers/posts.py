from fastapi import APIRouter, Depends, File, Query, Request, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, joinedload
from starlette.datastructures import UploadFile as StarletteUploadFile
from starlette.exceptions import HTTPException as StarletteHTTPException

from deps import get_current_user, get_db
from errors import ApiError, StorageError, forbidden, validation_error
from avatars import (
    ALLOWED_TYPES,
    MAX_POST_IMAGE_BYTES,
    MAX_POST_IMAGES,
    delete_post_images,
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
from validate import parse_optional_category, parse_page, parse_page_size, parse_uuid

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
    images = parse_images(getattr(post, "images", None)) if include_images and post.category == "forum" else []
    return PostSummary(
        id=post.id,
        title=post.title,
        excerpt=post.excerpt,
        category=post.category,
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
        **_summary(post, include_images=post.category == "forum").model_dump(),
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


def _require_forum(post: Post) -> None:
    if post.category != "forum":
        raise validation_error(
            [{"field": "category", "message": "Comments are only available on forum posts."}]
        )


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
    previews = _forum_previews(db, rows) if category == "forum" else {}
    include_images = category == "forum"
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


def _forum_previews(db: Session, posts: list[Post]) -> dict[str, tuple[int, list[ReplyPreview]]]:
    ids = [post.id for post in posts if post.category == "forum"]
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
    _require_forum(post)

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
    _require_forum(post)

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
    if source.category != "forum":
        raise validation_error(
            [{"field": "category", "message": "Only forum posts can be promoted."}]
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
                "message": "Must be one of: news, sports.",
            }
        )
    if fields:
        raise validation_error(fields)

    try:
        post = create_post_with_audit(
            db,
            author=user,
            title=title,
            body=text,
            category=body.category,
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
    if post.category != "forum":
        raise validation_error(
            [{"field": "category", "message": "Images can only be added to forum posts."}]
        )
    images = parse_images(getattr(post, "images", None))
    if len(images) >= MAX_POST_IMAGES:
        raise validation_error(
            [{"field": "file", "message": "Forum posts can have at most 4 images."}]
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


def _image_field_errors(category: str, uploads: list[tuple[str, bytes]]) -> list[dict[str, str]]:
    fields: list[dict[str, str]] = []
    if uploads and category != "forum":
        fields.append({"field": "images", "message": "Images can only be added to forum posts."})
        return fields
    if len(uploads) > MAX_POST_IMAGES:
        fields.append({"field": "images", "message": "Forum posts can have at most 4 images."})
        return fields
    for _ext, data in uploads:
        if not data or len(data) > MAX_POST_IMAGE_BYTES:
            fields.append({"field": "images", "message": "Image must be 1–2000000 bytes."})
            break
    return fields


async def _read_upload_images(items: list) -> tuple[list[tuple[str, bytes]], list[dict[str, str]]]:
    uploads: list[tuple[str, bytes]] = []
    for item in items:
        if not isinstance(item, StarletteUploadFile):
            continue
        content_type = (item.content_type or "").split(";")[0].strip().lower()
        ext = ALLOWED_TYPES.get(content_type)
        if ext is None:
            return [], [{"field": "images", "message": "Image must be a jpeg, png, or webp file."}]
        data = await item.read()
        uploads.append((ext, data))
    return uploads, []


@router.post("/posts", status_code=201)
async def create_post(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content_type = (request.headers.get("content-type") or "").split(";")[0].strip().lower()
    uploads: list[tuple[str, bytes]] = []
    if content_type == "application/json":
        payload = await request.json()
        if not isinstance(payload, dict):
            raise validation_error([{"field": "title", "message": "Title must be 1–120 characters."}])
        body = CreatePostBody.model_validate(payload)
    elif content_type.startswith("multipart/form-data"):
        form = await request.form()
        body = CreatePostBody(
            title=str(form.get("title") or ""),
            body=str(form.get("body") or ""),
            category=str(form.get("category") or ""),
        )
        uploads, upload_fields = await _read_upload_images(form.getlist("images"))
        if upload_fields:
            raise validation_error(upload_fields)
    else:
        raise validation_error([{"field": "title", "message": "Title must be 1–120 characters."}])

    fields = _post_field_errors(body)
    fields.extend(_image_field_errors(body.category, uploads))
    if fields:
        raise validation_error(fields)
    if user.role not in STAFF_ROLES and body.category != "forum":
        raise forbidden("Students can only publish in forum.")

    try:
        post = create_post_with_audit(
            db,
            author=user,
            title=body.title.strip(),
            body=body.body.strip(),
            category=body.category,
        )
        if uploads:
            paths = [save_post_image(post.id, ext, data) for ext, data in uploads]
            post.images = dump_images(paths)
            db.flush()
    except StorageError:
        delete_post_images(getattr(post, "id", "") if "post" in locals() else "")
        raise ApiError(
            503,
            "storage_unavailable",
            "Could not save the post. Try again in a moment.",
        ) from None
    except OSError as exc:
        if "post" in locals():
            db.rollback()
            delete_post_images(post.id)
        raise StorageError() from exc
    except SQLAlchemyError as exc:
        if "post" in locals():
            delete_post_images(post.id)
        raise StorageError() from exc
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
