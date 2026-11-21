import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.controllers import (
    auth_controller,
    customer_controller,
    dashboard_controller,
    health_controller,
    inventory_controller,
    order_controller,
)
from app.core.config import settings
from app.core.database import Base, engine

# Model dosyalarını yüklüyoruz

# Yüklemelerin yapılacağı dizini otomatik oluşturur
os.makedirs(settings.UPLOAD_DIR / "avatars", exist_ok=True)

# Veritabanı tablolarını oluşturur
Base.metadata.create_all(bind=engine)

# create_all mevcut tablolara yeni sütun eklemez; customers tablosuna giriş için gereken sütunları ekle
with engine.begin() as conn:
    conn.execute(text("ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash VARCHAR"))
    conn.execute(text("ALTER TABLE customers ADD COLUMN IF NOT EXISTS avatar_url VARCHAR"))

app = FastAPI(title="ERP System API")

origins = settings.cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Statik görsel dosyalarını dışarı sunma
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Router Bağlantıları
app.include_router(health_controller.router)
app.include_router(auth_controller.router)
app.include_router(dashboard_controller.router)
app.include_router(inventory_controller.router)
app.include_router(order_controller.router)
app.include_router(customer_controller.router) # YENİ EKLENDİ

@app.get("/")
def read_root():
    return {"message": "ERP Backend API çalışıyor!"}