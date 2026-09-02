from fastapi import FastAPI
from app.core.database import engine, Base
from app.controllers import auth_controller

Base.metadata.create_all(bind=engine)

app = FastAPI(title="ERP System API", version="1.0.0")

app.include_router(auth_controller.router)

@app.get("/")
def root():
    return {"message": "ERP Backend API çalışıyor!"}