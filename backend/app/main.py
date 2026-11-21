from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.controllers import health_controller
from app.core.config import settings

app = FastAPI(title="Akıllı ERP API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_controller.router)
