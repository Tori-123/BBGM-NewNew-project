from pydantic import BaseModel, ConfigDict


NEWSPAPER_CATEGORIES = ("news", "sports")
CATEGORIES = (*NEWSPAPER_CATEGORIES, "forum")
CATEGORY_MESSAGE = "Must be one of: news, sports, forum."
ROLES = ("student", "editor", "admin")
STAFF_ROLES = ("editor", "admin")
ASSIGNABLE_ROLES = ("student", "editor")
AVATAR_PRESETS = ("oak", "gym", "book", "dorm", "bus", "night")
DEFAULT_AVATAR = "preset:oak"


class RegisterBody(BaseModel):
    email: str
    password: str
    display_name: str


class LoginBody(BaseModel):
    email: str
    password: str


class CreatePostBody(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str
    body: str
    category: str


class SetAvatarPresetBody(BaseModel):
    model_config = ConfigDict(extra="ignore")

    preset: str


class AuthorPublic(BaseModel):
    id: str
    display_name: str
    avatar: str


class UserPrivate(BaseModel):
    id: str
    email: str
    display_name: str
    role: str
    avatar: str
    created_at: str


class ReplyPreview(BaseModel):
    id: str
    body: str
    created_at: str
    author: AuthorPublic


class CreateCommentBody(BaseModel):
    model_config = ConfigDict(extra="ignore")

    body: str
    parent_id: str | None = None


class PromoteBody(BaseModel):
    model_config = ConfigDict(extra="ignore")

    category: str
    title: str | None = None
    body: str | None = None


class PatchUserRoleBody(BaseModel):
    model_config = ConfigDict(extra="ignore")

    role: str


class CommentReply(BaseModel):
    id: str
    body: str
    parent_id: str
    created_at: str
    author: AuthorPublic


class CommentFloor(BaseModel):
    id: str
    body: str
    parent_id: None
    floor: int
    created_at: str
    author: AuthorPublic
    replies: list[CommentReply]


class CommentList(BaseModel):
    items: list[CommentFloor]
    page: int
    page_size: int
    total: int


class UserList(BaseModel):
    items: list[UserPrivate]
    page: int
    page_size: int
    total: int


class PostSummary(BaseModel):
    id: str
    title: str
    excerpt: str
    category: str
    status: str
    created_at: str
    updated_at: str
    author: AuthorPublic
    reply_count: int
    reply_preview: list[ReplyPreview]
    images: list[str]


class PostDetail(PostSummary):
    body: str


class PostList(BaseModel):
    items: list[PostSummary]
    page: int
    page_size: int
    total: int
