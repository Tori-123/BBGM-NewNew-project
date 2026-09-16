import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

_BACKEND_DIR = Path(__file__).resolve().parent
_ROOT_DIR = _BACKEND_DIR.parent


@dataclass(frozen=True)
class Settings:
    database_url: str
    session_secret: str
    frontend_origin: str
    admin_email: str


def _load_env_file(path: Path) -> None:
    try:
        load_dotenv(path)
    except OSError:
        pass


def load_settings() -> Settings:
    _load_env_file(_ROOT_DIR / ".env")
    _load_env_file(_BACKEND_DIR / ".env")

    session_secret = (os.environ.get("SESSION_SECRET") or "").strip()
    if not session_secret:
        raise RuntimeError("SESSION_SECRET is required")

    database_url = (os.environ.get("DATABASE_URL") or "").strip()
    if not database_url:
        raise RuntimeError("DATABASE_URL is required")

    frontend_origin = (os.environ.get("FRONTEND_ORIGIN") or "http://localhost:5173").strip()
    admin_email = (os.environ.get("ADMIN_EMAIL") or "").strip().lower()
    return Settings(
        database_url=database_url,
        session_secret=session_secret,
        frontend_origin=frontend_origin,
        admin_email=admin_email,
    )
