"""Ortak hata biçimi: {"code": ..., "message": ..., "details": ...}."""

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    status_code = 400
    code = "BAD_REQUEST"

    def __init__(self, message: str, *, code: str | None = None, details: Any = None):
        super().__init__(message)
        self.message = message
        self.details = details
        if code:
            self.code = code


class UnauthorizedError(AppError):
    status_code = 401
    code = "UNAUTHORIZED"


class ForbiddenError(AppError):
    status_code = 403
    code = "FORBIDDEN"


class NotFoundError(AppError):
    status_code = 404
    code = "NOT_FOUND"


class ConflictError(AppError):
    status_code = 409
    code = "CONFLICT"


class TooManyRequestsError(AppError):
    status_code = 429
    code = "TOO_MANY_REQUESTS"


HTTP_STATUS_CODES = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    429: "TOO_MANY_REQUESTS",
}


def error_body(code: str, message: str, details: Any = None) -> dict:
    return {"code": code, "message": message, "details": details}


def _field_path(loc: tuple) -> str:
    # ("body", "email") -> "email"; sorgu parametrelerinde de ilk öğe atlanır
    return ".".join(str(part) for part in loc[1:]) or str(loc[0])


def _clean_message(msg: str) -> str:
    return msg.removeprefix("Value error, ")


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError):
        headers = {"WWW-Authenticate": "Bearer"} if exc.status_code == 401 else None
        return JSONResponse(
            status_code=exc.status_code, content=error_body(exc.code, exc.message, exc.details), headers=headers
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError):
        details = [
            {"field": _field_path(tuple(err["loc"])), "message": _clean_message(err["msg"])} for err in exc.errors()
        ]
        return JSONResponse(
            status_code=422, content=error_body("VALIDATION_ERROR", "Girilen bilgileri kontrol edin.", details)
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(_: Request, exc: StarletteHTTPException):
        code = HTTP_STATUS_CODES.get(exc.status_code, "ERROR")
        message = exc.detail if isinstance(exc.detail, str) else "İstek işlenemedi."
        return JSONResponse(status_code=exc.status_code, content=error_body(code, message), headers=exc.headers)
