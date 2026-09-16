from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from avatars import ensure_avatar_dir
from config import load_settings
from errors import register_exception_handlers
from models import init_db, make_engine, make_session_factory
from routers.admin import router as admin_router
from routers.auth import router as auth_router
from routers.posts import router as posts_router


def create_app() -> FastAPI:
    settings = load_settings()
    engine = make_engine(settings.database_url)
    init_db(engine)

    app = FastAPI(title="BBGM Scoop API")
    app.state.settings = settings
    app.state.engine = engine
    app.state.session_factory = make_session_factory(engine)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(posts_router, prefix="/api/v1")
    app.include_router(admin_router, prefix="/api/v1")
    app.mount("/uploads", StaticFiles(directory=str(ensure_avatar_dir().parent)), name="uploads")

    @app.get("/health")
    def health():
        return {"status": "ok"}

    return app


_app: FastAPI | None = None


def __getattr__(name: str):
    global _app
    if name == "app":
        if _app is None:
            _app = create_app()
        return _app
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
