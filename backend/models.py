from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def to_iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    display_name: Mapped[str] = mapped_column(String(40), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False, default="student")
    avatar: Mapped[str] = mapped_column(String(160), nullable=False, default="preset:oak")
    muted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    terms_accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    posts: Mapped[list["Post"]] = relationship(back_populates="author")
    sessions: Mapped[list["SessionRecord"]] = relationship(back_populates="user")
    comments: Mapped[list["Comment"]] = relationship(back_populates="author")
    likes: Mapped[list["PostLike"]] = relationship(back_populates="user")


class SessionRecord(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    user: Mapped[User] = relationship(back_populates="sessions")


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    excerpt: Mapped[str] = mapped_column(String(160), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    is_activity: Mapped[bool] = mapped_column(Boolean, nullable=False)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    images: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    author: Mapped[User] = relationship(back_populates="posts")
    comments: Mapped[list["Comment"]] = relationship(back_populates="post")
    likes: Mapped[list["PostLike"]] = relationship(back_populates="post")
    blocks: Mapped[list["NewsBlock"]] = relationship(back_populates="post")


class NewsBlock(Base):
    __tablename__ = "news_blocks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    post_id: Mapped[str] = mapped_column(ForeignKey("posts.id"), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    heading: Mapped[str] = mapped_column(String(120), nullable=False)
    published_heading: Mapped[str | None] = mapped_column(String(120), nullable=True)
    draft_body: Mapped[str] = mapped_column(Text, nullable=False)
    published_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    review_status: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    post: Mapped[Post] = relationship(back_populates="blocks")


class SystemNotice(Base):
    __tablename__ = "system_notices"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    post_id: Mapped[str] = mapped_column(ForeignKey("posts.id"), nullable=False)
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    parent_id: Mapped[str | None] = mapped_column(ForeignKey("comments.id"), nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    post: Mapped[Post] = relationship(back_populates="comments")
    author: Mapped[User] = relationship(back_populates="comments")


class PostLike(Base):
    __tablename__ = "post_likes"
    __table_args__ = (UniqueConstraint("user_id", "post_id", name="uq_post_likes_user_post"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    post_id: Mapped[str] = mapped_column(ForeignKey("posts.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    user: Mapped[User] = relationship(back_populates="likes")
    post: Mapped[Post] = relationship(back_populates="likes")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    post_id: Mapped[str] = mapped_column(ForeignKey("posts.id"), nullable=False)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class EmailCode(Base):
    __tablename__ = "email_codes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    purpose: Mapped[str] = mapped_column(String(16), nullable=False)
    code_hash: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


def make_engine(database_url: str):
    connect_args = {}
    if database_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
    return create_engine(database_url, connect_args=connect_args)


def make_session_factory(engine):
    return sessionmaker(bind=engine, expire_on_commit=False)


def _drop_sports_and_backfill_blocks(conn) -> None:
    sports_ids = [
        row[0] for row in conn.exec_driver_sql("SELECT id FROM posts WHERE category='sports'").fetchall()
    ]
    if sports_ids:
        marks = ",".join("?" for _ in sports_ids)
        for sql in (
            f"DELETE FROM comments WHERE post_id IN ({marks})",
            f"DELETE FROM post_likes WHERE post_id IN ({marks})",
            f"DELETE FROM audit_events WHERE post_id IN ({marks})",
            f"DELETE FROM news_blocks WHERE post_id IN ({marks})",
            f"DELETE FROM posts WHERE id IN ({marks})",
        ):
            conn.exec_driver_sql(sql, sports_ids)
    rows = conn.exec_driver_sql(
        """
        SELECT p.id, p.title, p.body, p.created_at
        FROM posts p
        WHERE p.category = 'news'
          AND NOT EXISTS (SELECT 1 FROM news_blocks b WHERE b.post_id = p.id)
        """
    ).fetchall()
    for post_id, title, body, created_at in rows:
        heading = ((title or "Story").strip() or "Story")[:120]
        text = body or ""
        conn.exec_driver_sql(
            """
            INSERT INTO news_blocks (
                id, post_id, position, heading, published_heading,
                draft_body, published_body, review_status, created_at, updated_at
            ) VALUES (?, ?, 1, ?, ?, ?, ?, 'published', ?, ?)
            """,
            (str(uuid4()), post_id, heading, heading, text, text, created_at, created_at),
        )


def migrate_schema(engine) -> None:
    if engine.dialect.name == "sqlite":
        with engine.begin() as conn:
            cols = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(users)").fetchall()}
            if cols and "role" not in cols:
                conn.exec_driver_sql(
                    "ALTER TABLE users ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'student'"
                )
            if cols and "avatar" not in cols:
                conn.exec_driver_sql(
                    "ALTER TABLE users ADD COLUMN avatar VARCHAR(160) NOT NULL DEFAULT 'preset:oak'"
                )
            if cols and "banned" not in cols:
                conn.exec_driver_sql(
                    "ALTER TABLE users ADD COLUMN banned INTEGER NOT NULL DEFAULT 0"
                )
            if cols and "muted" not in cols:
                conn.exec_driver_sql(
                    "ALTER TABLE users ADD COLUMN muted INTEGER NOT NULL DEFAULT 0"
                )
                if "banned" in cols:
                    conn.exec_driver_sql("UPDATE users SET muted = banned")
            if cols and "terms_accepted_at" not in cols:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN terms_accepted_at DATETIME")
            post_cols = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(posts)").fetchall()}
            if post_cols and "images" not in post_cols:
                conn.exec_driver_sql(
                    "ALTER TABLE posts ADD COLUMN images TEXT NOT NULL DEFAULT '[]'"
                )
    Base.metadata.create_all(engine)
    if engine.dialect.name == "sqlite":
        with engine.begin() as conn:
            tables = {
                row[0]
                for row in conn.exec_driver_sql(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                ).fetchall()
            }
            if "posts" in tables:
                conn.exec_driver_sql("UPDATE posts SET category='forum' WHERE category='community'")
                conn.exec_driver_sql("UPDATE posts SET category='news' WHERE category='dorm_life'")
                conn.exec_driver_sql("UPDATE posts SET category='news' WHERE category='events'")
                conn.exec_driver_sql(
                    "UPDATE posts SET is_activity=0, starts_at=NULL, location=NULL "
                    "WHERE is_activity != 0 OR starts_at IS NOT NULL OR location IS NOT NULL"
                )
                _drop_sports_and_backfill_blocks(conn)


def init_db(engine) -> None:
    migrate_schema(engine)
