from datetime import datetime, timedelta, timezone
import bcrypt
from jose import jwt
from fastapi import HTTPException, status
from app.repositories.user_repository import UserRepository
from app.schemas.user_schema import Token, UserCreate, UserLogin
from app.core.config import settings

class AuthService:
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo

    def _prepare_password_bytes(self, password: str) -> bytes:
        # Şifreyi utf-8 byte dizisine çevirip kesin olarak ilk 72 byte'ını alır
        return password.encode('utf-8')[:72]

    def hash_password(self, password: str) -> str:
        pwd_bytes = self._prepare_password_bytes(password)
        # Salt üretip şifreyi hashler
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(pwd_bytes, salt)
        return hashed.decode('utf-8')

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        try:
            pwd_bytes = self._prepare_password_bytes(plain_password)
            hashed_bytes = hashed_password.encode('utf-8')
            return bcrypt.checkpw(pwd_bytes, hashed_bytes)
        except Exception:
            return False

    def create_access_token(self, data: dict) -> str:
        to_encode = data.copy()
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode.update({"exp": expire})
        return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    def register_user(self, user_data: UserCreate):
        existing_user = self.user_repo.get_by_email(user_data.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bu e-posta adresi zaten kayıtlı."
            )
        
        try:
            hashed_pwd = self.hash_password(user_data.password)
            return self.user_repo.create_user(user_data, hashed_pwd)
        except Exception as e:
            print("KAYIT SIRASINDA DETAYLI HATA:", str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Veritabanı Hatası: {str(e)}"
            )

    def login_user(self, login_data: UserLogin) -> Token:
        user = self.user_repo.get_by_email(login_data.email)
        
        if not user or not self.verify_password(login_data.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="E-posta veya şifre hatalı."
            )
        
        access_token = self.create_access_token(data={"sub": user.email})
        
        return Token(
            access_token=access_token, 
            token_type="bearer",
            full_name=user.full_name
        )