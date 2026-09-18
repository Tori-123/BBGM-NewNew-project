import json
import shutil
from pathlib import Path
from uuid import uuid4

from schemas import AVATAR_PRESETS, DEFAULT_AVATAR

UPLOAD_ROOT = Path(__file__).resolve().parent / "uploads"
AVATAR_DIR = UPLOAD_ROOT / "avatars"
POST_IMAGE_DIR = UPLOAD_ROOT / "posts"
ALLOWED_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}
MAX_AVATAR_BYTES = 1_000_000
MAX_POST_IMAGE_BYTES = 2_000_000
MAX_POST_IMAGES = 4


def normalize_avatar(value: str | None) -> str:
    if not value:
        return DEFAULT_AVATAR
    if value.startswith("preset:"):
        preset = value.split(":", 1)[1]
        return f"preset:{preset}" if preset in AVATAR_PRESETS else DEFAULT_AVATAR
    if value.startswith("/uploads/avatars/"):
        return value
    return DEFAULT_AVATAR


def preset_avatar(preset: str) -> str:
    return f"preset:{preset}"


def ensure_avatar_dir() -> Path:
    AVATAR_DIR.mkdir(parents=True, exist_ok=True)
    return AVATAR_DIR


def parse_images(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str) and item.startswith("/uploads/posts/")][:MAX_POST_IMAGES]


def dump_images(paths: list[str]) -> str:
    return json.dumps(parse_images(json.dumps(paths)))


def ensure_post_image_dir(post_id: str) -> Path:
    folder = POST_IMAGE_DIR / post_id
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def save_post_image(post_id: str, ext: str, data: bytes) -> str:
    folder = ensure_post_image_dir(post_id)
    name = f"{uuid4()}.{ext}"
    (folder / name).write_bytes(data)
    return f"/uploads/posts/{post_id}/{name}"


def delete_post_images(post_id: str) -> None:
    folder = POST_IMAGE_DIR / post_id
    if folder.exists():
        shutil.rmtree(folder, ignore_errors=True)
