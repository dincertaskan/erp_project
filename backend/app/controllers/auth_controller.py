from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
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


@router.post("/register", response_model=CurrentUserOut, status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    """Yeni müşteri hesabı oluşturur."""
    return AuthService(db).register(data)


@router.post("/login", response_model=TokenOut)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    token, user = AuthService(db).login(data)
    return TokenOut(access_token=token, user=CurrentUserOut.model_validate(user))


@router.get("/me", response_model=CurrentUserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=CurrentUserOut)
def update_me(data: ProfileUpdateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return AuthService(db).update_profile(user, data)


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(data: PasswordChangeRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    AuthService(db).change_password(user, data)
