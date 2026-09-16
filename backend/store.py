from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, joinedload

from errors import StorageError
from models import AuditEvent, Comment, Post, SessionRecord, User, utc_now
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


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email))


def create_post_with_audit(
    db: Session,
    *,
    author: User,
    title: str,
    body: str,
    category: str,
    is_activity: bool,
    starts_at,
    location: str | None,
) -> Post:
    now = utc_now()
    post = Post(
        id=str(uuid4()),
        author_id=author.id,
        title=title,
        body=body,
        excerpt=make_excerpt(body),
        category=category,
        is_activity=is_activity,
        starts_at=starts_at,
        location=location,
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


def apply_admin_email(user: User, admin_email: str) -> None:
    if admin_email and user.email == admin_email and user.role != "admin":
        user.role = "admin"
