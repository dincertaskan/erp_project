from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.controllers import (
    auth_controller,
    category_controller,
    health_controller,
    product_controller,
    stock_controller,
    user_controller,
)
from app.core.config import settings
from app.core.errors import register_error_handlers

app = FastAPI(title="Akıllı ERP API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)

app.include_router(health_controller.router)
app.include_router(auth_controller.router)
app.include_router(user_controller.router)
app.include_router(category_controller.router)
app.include_router(product_controller.router)
app.include_router(stock_controller.router)
