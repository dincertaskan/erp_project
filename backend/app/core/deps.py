from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import ForbiddenError, UnauthorizedError
from app.core.security import decode_access_token
from app.models import User, UserRole

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise UnauthorizedError("Bu işlem için giriş yapmalısınız.")
    user_id = decode_access_token(credentials.credentials)
    user = db.get(User, user_id) if user_id is not None else None
    if user is None:
        raise UnauthorizedError("Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.", code="INVALID_TOKEN")
    if not user.is_active:
        raise UnauthorizedError("Hesabınız pasif durumda.", code="ACCOUNT_INACTIVE")
    return user


def require_roles(*roles: UserRole):
    """Yalnızca verilen rollerdeki kullanıcıların erişebildiği uçlar için bağımlılık."""

    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise ForbiddenError("Bu işlem için yetkiniz yok.")
        return user

    return checker
