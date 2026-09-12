from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.controllers import auth_controller,dashboard_controller,inventory_controller
from app.core.database import Base, engine

# Model dosyasını doğrudan import ederek Base'e yüklüyoruz (Tablonun otomatik oluşmasını sağlar)
from app.models.user import User
from app.models.erp import Category, Product, Sale, StockMovement

# Veritabanı tablosu yoksa otomatik oluşturur
Base.metadata.create_all(bind=engine)

app = FastAPI(title="ERP System API")

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_controller.router)
app.include_router(dashboard_controller.router)
app.include_router(inventory_controller.router)

@app.get("/")
def read_root():
    return {"message": "ERP Backend API çalışıyor!"}