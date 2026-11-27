import math

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.errors import TooManyRequestsError
from app.core.rate_limit import register_throttle
from app.core.routing import SessionReleasingRoute
from app.models import User
from app.schemas.user import (
    CurrentUserOut,
    LoginRequest,
    PasswordChangeRequest,
    ProfileUpdateRequest,
    RegisterRequest,
    TokenOut,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Kimlik"], route_class=SessionReleasingRoute)


def client_ip(request: Request) -> str:
    # Proxy arkasında gerçek istemci adresini uvicorn X-Forwarded-For'dan alır (FORWARDED_ALLOW_IPS).
    return request.client.host if request.client else "unknown"


@router.post("/register", response_model=CurrentUserOut, status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    """Yeni müşteri hesabı oluşturur. IP başına sınırlıdır (REGISTER_RATE_LIMIT / REGISTER_RATE_WINDOW_MINUTES)."""
    # Başarılı ya da başarısız her deneme sayılır: hepsi bcrypt çalıştırır, davet kodu tahminini de yavaşlatır.
    retry_after = register_throttle.hit(client_ip(request))
    if retry_after:
        minutes = math.ceil(retry_after / 60)
        raise TooManyRequestsError(
            f"Çok fazla deneme yapıldı, {minutes} dakika sonra tekrar deneyin.", details={"retry_after": retry_after}
        )
    return AuthService(db).register(data)


@router.post("/login", response_model=TokenOut)
def login(data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """Hatalı denemeler sınırlıdır: aynı e-postaya 5, aynı IP'den 20 hatalı denemeden sonra 15 dakika 429 döner."""
    token, user = AuthService(db).login(data, client_ip(request))
    return TokenOut(access_token=token, user=CurrentUserOut.model_validate(user))


@router.get("/me", response_model=CurrentUserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=CurrentUserOut)
def update_me(data: ProfileUpdateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return AuthService(db).update_profile(user, data)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Kullanıcının tüm cihazlardaki oturumlarını sonlandırır; daha önce verilen token'lar 401 alır."""
    AuthService(db).logout(user)


@router.post("/me/password", response_model=TokenOut)
def change_password(data: PasswordChangeRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Şifre değişince öteki oturumlar sonlanır; bu oturum yanıttaki yeni token'la sürer."""
    token = AuthService(db).change_password(user, data)
    return TokenOut(access_token=token, user=CurrentUserOut.model_validate(user))
