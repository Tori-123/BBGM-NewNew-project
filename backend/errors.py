from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class ApiError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        fields: list[dict[str, str]] | None = None,
    ) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message
        self.fields = fields or []


class StorageError(Exception):
    def __init__(self, message: str = "Storage is unavailable. Try again in a moment.") -> None:
        self.message = message


def error_body(code: str, message: str, fields: list[dict[str, str]] | None = None) -> dict:
    return {"error": {"code": code, "message": message, "fields": fields or []}}


def error_response(
    status_code: int,
    code: str,
    message: str,
    fields: list[dict[str, str]] | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=error_body(code, message, fields),
    )


def unauthenticated() -> ApiError:
    return ApiError(401, "unauthenticated", "Please sign in to continue.")


def forbidden(message: str = "You do not have permission to do that.") -> ApiError:
    return ApiError(403, "forbidden", message)


def validation_error(fields: list[dict[str, str]]) -> ApiError:
    return ApiError(
        422,
        "validation_error",
        "One or more fields are invalid.",
        fields,
    )


def _field_from_loc(loc: tuple) -> str:
    parts = [str(item) for item in loc if item not in ("body", "query", "path")]
    return parts[-1] if parts else "request"


async def api_error_handler(_request: Request, exc: ApiError) -> JSONResponse:
    return error_response(exc.status_code, exc.code, exc.message, exc.fields)


async def storage_error_handler(_request: Request, exc: StorageError) -> JSONResponse:
    return error_response(503, "storage_unavailable", exc.message)


async def validation_error_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    fields = [
        {"field": _field_from_loc(err.get("loc", ())), "message": err.get("msg", "Invalid value.")}
        for err in exc.errors()
    ]
    return error_response(
        422,
        "validation_error",
        "One or more fields are invalid.",
        fields,
    )


async def http_exception_handler(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
    if exc.status_code == 405:
        return error_response(405, "method_not_allowed", "This method is not allowed.")
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    message = exc.detail if isinstance(exc.detail, str) else "Request failed."
    code = "not_found" if exc.status_code == 404 else "bad_request"
    return error_response(exc.status_code, code, message)


def register_exception_handlers(app) -> None:
    app.add_exception_handler(ApiError, api_error_handler)
    app.add_exception_handler(StorageError, storage_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
