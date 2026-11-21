import re
from datetime import datetime

from pydantic import EmailStr, Field, field_validator

from app.models import UserRole
from app.schemas.common import ApiModel, RequestModel

PASSWORD_MIN_LENGTH = 8


def validate_password_strength(password: str) -> str:
    if len(password) < PASSWORD_MIN_LENGTH:
        raise ValueError(f"Şifre en az {PASSWORD_MIN_LENGTH} karakter olmalıdır.")
    if not re.search(r"[A-ZÇĞİÖŞÜ]", password):
        raise ValueError("Şifre en az bir büyük harf içermelidir.")
    if not re.search(r"[a-zçğıöşü]", password):
        raise ValueError("Şifre en az bir küçük harf içermelidir.")
    if not re.search(r"\d", password):
        raise ValueError("Şifre en az bir rakam içermelidir.")
    return password


class CustomerProfile(ApiModel):
    id: int
    phone: str | None
    company_name: str | None
    address: str | None
    city: str | None


class UserOut(ApiModel):
    id: int
    full_name: str
    email: str
    role: UserRole
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None


class CurrentUserOut(UserOut):
    customer: CustomerProfile | None = None


class RegisterRequest(RequestModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr = Field(max_length=255)
    password: str = Field(max_length=128)
    phone: str | None = Field(None, max_length=30)

    @field_validator("email")
    @classmethod
    def lower_email(cls, value: str) -> str:
        return value.lower()

    @field_validator("password")
    @classmethod
    def strong_password(cls, value: str) -> str:
        return validate_password_strength(value)


class LoginRequest(RequestModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def lower_email(cls, value: str) -> str:
        return value.lower()


class TokenOut(ApiModel):
    access_token: str
    token_type: str = "bearer"
    user: CurrentUserOut


class ProfileUpdateRequest(RequestModel):
    full_name: str | None = Field(None, min_length=2, max_length=100)
    phone: str | None = Field(None, max_length=30)
    company_name: str | None = Field(None, max_length=150)
    address: str | None = Field(None, max_length=1000)
    city: str | None = Field(None, max_length=100)


class PasswordChangeRequest(RequestModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(max_length=128)

    @field_validator("new_password")
    @classmethod
    def strong_password(cls, value: str) -> str:
        return validate_password_strength(value)


class RoleUpdateRequest(RequestModel):
    role: UserRole


class StatusUpdateRequest(RequestModel):
    is_active: bool
