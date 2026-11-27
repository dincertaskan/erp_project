import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import anyio.to_thread
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.controllers import (
    audit_controller,
    auth_controller,
    category_controller,
    customer_controller,
    dashboard_controller,
    health_controller,
    order_controller,
    product_controller,
    report_controller,
    shop_controller,
    stock_controller,
    user_controller,
)
from app.core.config import settings
from app.core.errors import register_error_handlers
from app.core.logging import configure_logging
from app.core.security_headers import SecurityHeadersMiddleware

configure_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    if settings.STOCK_STRATEGY == "none":
        logger.warning(
            "STOCK_STRATEGY=none: stok kilidi kapalı, eşzamanlı onaylarda stok eksiye düşebilir. "
            "Yalnızca deney içindir."
        )
    # Senkron uç noktalar iş parçacığı havuzunda çalışır. İş parçacığı sayısı bağlantı havuzu kapasitesine
    # eşitlenir; böylece iş parçacıkları bağlantı beklerken bloke olmaz, fazla istekler sırada bekler.
    anyio.to_thread.current_default_thread_limiter().total_tokens = settings.DB_POOL_SIZE + settings.DB_MAX_OVERFLOW
    yield


def create_app() -> FastAPI:
    """Uygulamayı geçerli ayarlarla kurar. Testler farklı ayarlarla ayrı bir örnek oluşturabilir."""
    # ENABLE_DOCS kapalıyken belge yolları hiç kaydedilmez; /docs, /redoc ve /openapi.json 404 döner.
    docs = {} if settings.ENABLE_DOCS else {"docs_url": None, "redoc_url": None, "openapi_url": None}
    application = FastAPI(title="Akıllı ERP API", lifespan=lifespan, **docs)

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        # Kimlik doğrulama Authorization başlığıyla yapılır, çerez kullanılmaz; kimlik bilgili CORS gerekmez.
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    # En son eklenen ara katman en dışta çalışır; başlıklar CORS ön kontrol yanıtlarına da eklenir.
    application.add_middleware(SecurityHeadersMiddleware)

    register_error_handlers(application)

    application.include_router(health_controller.router)
    application.include_router(auth_controller.router)
    application.include_router(user_controller.router)
    application.include_router(category_controller.router)
    application.include_router(product_controller.router)
    application.include_router(stock_controller.router)
    application.include_router(customer_controller.router)
    application.include_router(order_controller.router)
    application.include_router(dashboard_controller.router)
    application.include_router(shop_controller.catalog_router)
    application.include_router(shop_controller.me_router)
    application.include_router(report_controller.router)
    application.include_router(audit_controller.router)

    return application


app = create_app()
