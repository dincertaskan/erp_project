import os
import shutil
from fastapi import APIRouter, Depends, status, File, UploadFile, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.user_schema import UserCreate, UserLogin, UserResponse, Token
from app.repositories.user_repository import UserRepository
from app.services.auth_service import AuthService
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["Auth"])

def get_auth_service(db: Session = Depends(get_db)) -> AuthService:
    user_repo = UserRepository(db)
    return AuthService(user_repo)

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: UserCreate, auth_service: AuthService = Depends(get_auth_service)):
    return auth_service.register_user(user_data)

@router.post("/login", response_model=Token)
def login(login_data: UserLogin, auth_service: AuthService = Depends(get_auth_service)):
    return auth_service.login_user(login_data)

# YENİ EKLENDİ: Kullanıcı Profil Bilgisi Çekme Endpoint'i
@router.get("/me", response_model=UserResponse)
def get_current_user_profile(user_name: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.full_name == user_name).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")
    return user

# YENİ EKLENDİ: Profil Fotoğrafı Yükleme Endpoint'i
@router.post("/upload-avatar")
async def upload_avatar(
    user_name: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # Görsel format kontrolü
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Lütfen sadece JPG, PNG veya WEBP formatında resim yükleyin.")

    # Dosya adını temizleyip sunucuya kaydetme
    file_ext = file.filename.split(".")[-1]
    safe_username = "".join(c for c in user_name if c.isalnum())
    filename = f"avatar_{safe_username}.{file_ext}"
    file_path = f"uploads/avatars/{filename}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Veritabanında güncelleme
    avatar_url = f"/uploads/avatars/{filename}"
    user = db.query(User).filter(User.full_name == user_name).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")

    user.avatar_url = avatar_url
    db.commit()

    return {"message": "Profil fotoğrafı başarıyla yüklendi", "avatar_url": avatar_url}