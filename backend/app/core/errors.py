"""Ortak hata biçimi: {"code": ..., "message": ..., "details": ...}."""

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.exc import TimeoutError as SQLAlchemyTimeoutError
from sqlalchemy.orm.exc import StaleDataError
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("app.errors")


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


# Oku-kontrol et-yaz denetimleri eşzamanlı isteklerde atlanabilir; bu durumda veritabanındaki benzersizlik
# kısıtı devreye girer. Bilinen kısıtlar servislerin döndürdüğü kod ve mesajla eşleştirilir.
UNIQUE_CONFLICTS: dict[str, tuple[str, str, str]] = {
    "uq_products_sku": ("SKU_TAKEN", "sku", "Bu SKU kullanılıyor."),
    "uq_categories_name_lower": ("CATEGORY_NAME_TAKEN", "name", "Bu isimde bir kategori zaten var."),
    "uq_users_email_lower": ("EMAIL_TAKEN", "email", "Bu e-posta adresi zaten kayıtlı."),
    "uq_customers_email_lower": ("EMAIL_TAKEN", "email", "Bu e-posta adresiyle kayıtlı bir müşteri var."),
}

CONCURRENT_UPDATE_MESSAGE = "Kayıt başka bir işlem tarafından değiştirildi. Sayfayı yenileyip tekrar deneyin."


def integrity_conflict(exc: IntegrityError) -> dict:
    diag = getattr(exc.orig, "diag", None)
    known = UNIQUE_CONFLICTS.get(getattr(diag, "constraint_name", None) or "")
    if known is None:
        return error_body("CONFLICT", "İşlem mevcut bir kayıtla çakışıyor. Sayfayı yenileyip tekrar deneyin.")
    code, field, message = known
    return error_body(code, message, [{"field": field, "message": message}])


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

    @app.exception_handler(SQLAlchemyTimeoutError)
    async def handle_pool_timeout(_: Request, exc: SQLAlchemyTimeoutError):
        # Bağlantı havuzu dolu: istemci kısa süre sonra yeniden deneyebilir.
        logger.warning("Veritabanı bağlantı havuzu dolu: %s", exc)
        return JSONResponse(
            status_code=503,
            content=error_body("SERVER_BUSY", "Sunucu şu anda yoğun. Lütfen biraz sonra tekrar deneyin."),
            headers={"Retry-After": "1"},
        )

    @app.exception_handler(StaleDataError)
    async def handle_stale_data(_: Request, exc: StaleDataError):
        # İyimser kilit: kayıt okunduktan sonra başka bir işlem sürümünü artırdı.
        logger.info("Eşzamanlı güncelleme: %s", exc)
        return JSONResponse(status_code=409, content=error_body("CONCURRENT_UPDATE", CONCURRENT_UPDATE_MESSAGE))

    @app.exception_handler(IntegrityError)
    async def handle_integrity_error(_: Request, exc: IntegrityError):
        logger.info("Veritabanı kısıtı ihlali: %s", exc.orig)
        return JSONResponse(status_code=409, content=integrity_conflict(exc))

    @app.exception_handler(Exception)
    async def handle_unexpected(_: Request, exc: Exception):
        # Beklenmeyen hatalar da ortak {code, message} biçiminde döner; ayrıntı yalnızca sunucu logunda.
        logger.exception("Beklenmeyen hata", exc_info=exc)
        return JSONResponse(status_code=500, content=error_body("INTERNAL_ERROR", "Beklenmeyen bir hata oluştu."))

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(_: Request, exc: StarletteHTTPException):
        code = HTTP_STATUS_CODES.get(exc.status_code, "ERROR")
        message = exc.detail if isinstance(exc.detail, str) else "İstek işlenemedi."
        return JSONResponse(status_code=exc.status_code, content=error_body(code, message), headers=exc.headers)
