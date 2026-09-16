from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from avatars import normalize_avatar
from deps import get_admin_user, get_db
from errors import ApiError, StorageError, forbidden, validation_error
from models import User, to_iso
from schemas import ASSIGNABLE_ROLES, PatchUserRoleBody, UserList, UserPrivate
from validate import parse_page, parse_page_size, parse_uuid

router = APIRouter()


def _user_private(user: User) -> dict:
    return UserPrivate(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        avatar=normalize_avatar(getattr(user, "avatar", None)),
        created_at=to_iso(user.created_at),
    ).model_dump()


@router.get("/admin/users")
def list_users(
    _: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
    page: str | None = Query(default=None),
    page_size: str | None = Query(default=None),
):
    parsed_page = parse_page(page)
    parsed_size = parse_page_size(page_size)
    try:
        total = db.scalar(select(func.count()).select_from(User)) or 0
        rows = db.scalars(
            select(User)
            .order_by(User.created_at.desc())
            .offset((parsed_page - 1) * parsed_size)
            .limit(parsed_size)
        ).all()
    except SQLAlchemyError as exc:
        raise StorageError() from exc
    return UserList(
        items=[UserPrivate(**_user_private(user)) for user in rows],
        page=parsed_page,
        page_size=parsed_size,
        total=total,
    ).model_dump()


@router.patch("/admin/users/{user_id}")
def patch_user_role(
    user_id: str,
    body: PatchUserRoleBody,
    _: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    user_id = parse_uuid(user_id, "user_id")
    if body.role not in ASSIGNABLE_ROLES:
        raise validation_error([{"field": "role", "message": "Must be one of: student, editor."}])
    try:
        target = db.scalar(select(User).where(User.id == user_id))
    except SQLAlchemyError as exc:
        raise StorageError() from exc
    if target is None:
        raise ApiError(404, "not_found", "User not found.")
    if target.role == "admin":
        raise forbidden("Admin accounts cannot be changed here.")
    target.role = body.role
    return _user_private(target)
