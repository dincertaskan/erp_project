from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.controllers import auth_controller

app = FastAPI(title="ERP System API")

# CORS (Tarayıcı Güvenlik İzinleri) Yapılandırması
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # GET, POST, OPTIONS vb. tüm metodlara izin ver
    allow_headers=["*"],  # Tüm başlık bilgilerine izin ver
)

# Rotaları Ekleme (prefix auth_controller içinde zaten tanımlı)
app.include_router(auth_controller.router)

@app.get("/")
def read_root():
    return {"message": "ERP Backend API çalışıyor!"}