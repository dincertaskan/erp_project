from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import anyio.to_thread
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.controllers import (
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
from app.core.security_headers import SecurityHeadersMiddleware


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # Senkron uç noktalar iş parçacığı havuzunda çalışır. İş parçacığı sayısı bağlantı havuzu kapasitesine
    # eşitlenir; böylece iş parçacıkları bağlantı beklerken bloke olmaz, fazla istekler sırada bekler.
    anyio.to_thread.current_default_thread_limiter().total_tokens = settings.DB_POOL_SIZE + settings.DB_MAX_OVERFLOW
    yield


app = FastAPI(title="Akıllı ERP API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# En son eklenen ara katman en dışta çalışır; başlıklar CORS ön kontrol yanıtlarına da eklenir.
app.add_middleware(SecurityHeadersMiddleware)

register_error_handlers(app)

app.include_router(health_controller.router)
app.include_router(auth_controller.router)
app.include_router(user_controller.router)
app.include_router(category_controller.router)
app.include_router(product_controller.router)
app.include_router(stock_controller.router)
app.include_router(customer_controller.router)
app.include_router(order_controller.router)
app.include_router(dashboard_controller.router)
app.include_router(shop_controller.catalog_router)
app.include_router(shop_controller.me_router)
app.include_router(report_controller.router)
