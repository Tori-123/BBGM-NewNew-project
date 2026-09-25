from uuid import uuid4

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, joinedload

from errors import StorageError
from models import AuditEvent, Comment, Post, PostLike, SessionRecord, User, utc_now
from security import hash_token, new_session_token


def make_excerpt(body: str) -> str:
    text = body.strip()
    return text[:160]


def create_session(db: Session, user_id: str) -> str:
    token = new_session_token()
    record = SessionRecord(
        id=str(uuid4()),
        token_hash=hash_token(token),
        user_id=user_id,
        revoked_at=None,
        created_at=utc_now(),
    )
    db.add(record)
    db.flush()
    return token


def get_active_session(db: Session, token: str) -> SessionRecord | None:
    return db.scalar(
        select(SessionRecord)
        .options(joinedload(SessionRecord.user))
        .where(
            SessionRecord.token_hash == hash_token(token),
            SessionRecord.revoked_at.is_(None),
        )
    )


def get_session_by_token(db: Session, token: str) -> SessionRecord | None:
    return db.scalar(
        select(SessionRecord)
        .options(joinedload(SessionRecord.user))
        .where(SessionRecord.token_hash == hash_token(token))
    )


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email))


def create_post_with_audit(
    db: Session,
    *,
    author: User,
    title: str,
    body: str,
    category: str,
) -> Post:
    now = utc_now()
    post = Post(
        id=str(uuid4()),
        author_id=author.id,
        title=title,
        body=body,
        excerpt=make_excerpt(body),
        category=category,
        is_activity=False,
        starts_at=None,
        location=None,
        status="published",
        images="[]",
        created_at=now,
        updated_at=now,
    )
    audit = AuditEvent(
        id=str(uuid4()),
        actor_id=author.id,
        action="create_post",
        post_id=post.id,
        at=now,
    )
    try:
        db.add(post)
        db.flush()
        audit.post_id = post.id
        db.add(audit)
        db.flush()
    except SQLAlchemyError as exc:
        db.rollback()
        raise StorageError("Could not save the post. Try again in a moment.") from exc
    post.author = author
    return post


def create_comment(
    db: Session,
    *,
    post: Post,
    author: User,
    body: str,
    parent_id: str | None,
) -> Comment:
    comment = Comment(
        id=str(uuid4()),
        post_id=post.id,
        author_id=author.id,
        parent_id=parent_id,
        body=body,
        created_at=utc_now(),
    )
    try:
        db.add(comment)
        db.flush()
    except SQLAlchemyError as exc:
        db.rollback()
        raise StorageError() from exc
    comment.author = author
    return comment


def count_likes(db: Session, post_id: str) -> int:
    try:
        return db.scalar(select(func.count()).select_from(PostLike).where(PostLike.post_id == post_id)) or 0
    except SQLAlchemyError as exc:
        raise StorageError() from exc


def user_liked(db: Session, *, user_id: str, post_id: str) -> bool:
    try:
        return (
            db.scalar(select(PostLike.id).where(PostLike.user_id == user_id, PostLike.post_id == post_id))
            is not None
        )
    except SQLAlchemyError as exc:
        raise StorageError() from exc


def like_counts_for_posts(db: Session, post_ids: list[str]) -> dict[str, int]:
    if not post_ids:
        return {}
    try:
        rows = db.execute(
            select(PostLike.post_id, func.count())
            .where(PostLike.post_id.in_(post_ids))
            .group_by(PostLike.post_id)
        ).all()
    except SQLAlchemyError as exc:
        raise StorageError() from exc
    return {post_id: count for post_id, count in rows}


def liked_post_ids(db: Session, *, user_id: str, post_ids: list[str]) -> set[str]:
    if not post_ids:
        return set()
    try:
        return set(
            db.scalars(
                select(PostLike.post_id).where(PostLike.user_id == user_id, PostLike.post_id.in_(post_ids))
            ).all()
        )
    except SQLAlchemyError as exc:
        raise StorageError() from exc


def add_like(db: Session, *, user_id: str, post_id: str) -> bool:
    if user_liked(db, user_id=user_id, post_id=post_id):
        return False
    like = PostLike(
        id=str(uuid4()),
        user_id=user_id,
        post_id=post_id,
        created_at=utc_now(),
    )
    try:
        with db.begin_nested():
            db.add(like)
            db.flush()
        return True
    except IntegrityError:
        return False
    except SQLAlchemyError as exc:
        raise StorageError() from exc


def remove_like(db: Session, *, user_id: str, post_id: str) -> None:
    try:
        like = db.scalar(select(PostLike).where(PostLike.user_id == user_id, PostLike.post_id == post_id))
        if like is not None:
            db.delete(like)
            db.flush()
    except SQLAlchemyError as exc:
        raise StorageError() from exc


def apply_admin_email(user: User, admin_email: str) -> None:
    if admin_email and user.email == admin_email and user.role != "admin":
        user.role = "admin"


def revoke_user_sessions(db: Session, user_id: str) -> None:
    now = utc_now()
    rows = db.scalars(
        select(SessionRecord).where(
            SessionRecord.user_id == user_id,
            SessionRecord.revoked_at.is_(None),
        )
    ).all()
    for row in rows:
        row.revoked_at = now


def delete_post_graph(db: Session, post: Post) -> None:
    post_id = post.id
    try:
        db.execute(delete(Comment).where(Comment.post_id == post_id, Comment.parent_id.is_not(None)))
        db.execute(delete(Comment).where(Comment.post_id == post_id))
        db.execute(delete(PostLike).where(PostLike.post_id == post_id))
        db.execute(delete(AuditEvent).where(AuditEvent.post_id == post_id))
        db.delete(post)
        db.flush()
    except SQLAlchemyError as exc:
        raise StorageError() from exc
