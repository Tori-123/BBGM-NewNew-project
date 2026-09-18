import re
from uuid import UUID

from errors import ApiError, validation_error
from schemas import CATEGORIES, CATEGORY_MESSAGE

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def parse_page(value: str | None) -> int:
    if value is None or value == "":
        return 1
    if not value.isdigit() or int(value) < 1:
        raise ApiError(400, "bad_request", "page must be an integer greater than or equal to 1.")
    return int(value)


def parse_page_size(value: str | None) -> int:
    if value is None or value == "":
        return 20
    if not value.isdigit():
        raise ApiError(400, "bad_request", "page_size must be an integer between 1 and 50.")
    size = int(value)
    if size < 1 or size > 50:
        raise ApiError(400, "bad_request", "page_size must be an integer between 1 and 50.")
    return size


def parse_optional_category(value: str | None) -> str | None:
    if value is None:
        return None
    if value not in CATEGORIES:
        raise validation_error([{"field": "category", "message": CATEGORY_MESSAGE}])
    return value


def parse_uuid(value: str, field: str = "post_id") -> str:
    try:
        return str(UUID(value))
    except ValueError as exc:
        raise ApiError(400, "bad_request", f"{field} must be a UUID.") from exc


def normalize_email(value: str) -> str:
    return value.strip().lower()


def register_field_errors(email: str, password: str, display_name: str) -> list[dict[str, str]]:
    fields: list[dict[str, str]] = []
    normalized = normalize_email(email)
    if not normalized or not EMAIL_RE.match(normalized):
        fields.append({"field": "email", "message": "Enter a valid email address."})
    if len(password) < 8 or len(password) > 128:
        fields.append({"field": "password", "message": "Password must be 8–128 characters."})
    name = display_name.strip()
    if not name or len(name) > 40:
        fields.append({"field": "display_name", "message": "Display name must be 1–40 characters."})
    return fields


def login_field_errors(email: str, password: str) -> list[dict[str, str]]:
    fields: list[dict[str, str]] = []
    if not email.strip():
        fields.append({"field": "email", "message": "Email is required."})
    elif not EMAIL_RE.match(normalize_email(email)):
        fields.append({"field": "email", "message": "Enter a valid email address."})
    if not password:
        fields.append({"field": "password", "message": "Password is required."})
    return fields
