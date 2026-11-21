from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles
from app.models import User, UserRole
from app.schemas.common import Page, PageParams
from app.schemas.user import RoleUpdateRequest, StatusUpdateRequest, UserOut
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["Kullanıcılar"])

admin_only = require_roles(UserRole.ADMIN)


@router.get("", response_model=Page[UserOut])
def list_users(
    page: PageParams = Depends(),
    search: str | None = Query(None, max_length=100),
    role: UserRole | None = None,
    is_active: bool | None = None,
    _: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return UserService(db).list(page, search=search, role=role, is_active=is_active)


@router.patch("/{user_id}/role", response_model=UserOut)
def set_role(user_id: int, data: RoleUpdateRequest, actor: User = Depends(admin_only), db: Session = Depends(get_db)):
    return UserService(db).set_role(actor, user_id, data.role)


@router.patch("/{user_id}/status", response_model=UserOut)
def set_status(
    user_id: int, data: StatusUpdateRequest, actor: User = Depends(admin_only), db: Session = Depends(get_db)
):
    return UserService(db).set_status(actor, user_id, data.is_active)
