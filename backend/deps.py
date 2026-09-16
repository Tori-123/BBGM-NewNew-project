from fastapi import Depends, Request
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from errors import StorageError, forbidden, unauthenticated
from models import User
from security import COOKIE_NAME, unsign_cookie_value
from store import get_active_session


def get_db(request: Request):
    session = request.app.state.session_factory()
    try:
        yield session
        session.commit()
    except StorageError:
        session.rollback()
        raise
    except SQLAlchemyError as exc:
        session.rollback()
        raise StorageError() from exc
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    raw = request.cookies.get(COOKIE_NAME)
    if not raw:
        raise unauthenticated()
    token = unsign_cookie_value(raw, request.app.state.settings.session_secret)
    if not token:
        raise unauthenticated()
    record = get_active_session(db, token)
    if record is None:
        raise unauthenticated()
    return record.user


def get_admin_user(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise forbidden()
    return user
