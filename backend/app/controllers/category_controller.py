from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles
from app.core.routing import SessionReleasingRoute
from app.models import User, UserRole
from app.schemas.catalog import CategoryOut, CategoryRequest
from app.schemas.user import StatusUpdateRequest
from app.services.category_service import CategoryService

router = APIRouter(prefix="/categories", tags=["Kategoriler"], route_class=SessionReleasingRoute)

staff = require_roles(UserRole.ADMIN, UserRole.WAREHOUSE)
admin_only = require_roles(UserRole.ADMIN)


@router.get("", response_model=list[CategoryOut])
def list_categories(
    search: str | None = Query(None, max_length=100),
    is_active: bool | None = None,
    _: User = Depends(staff),
    db: Session = Depends(get_db),
):
    """Kategori sayısı az olduğu için sayfalanmaz; ürün sayısı yalnızca aktif ürünleri sayar."""
    return CategoryService(db).list(search=search, is_active=is_active)


@router.post("", response_model=CategoryOut, status_code=201)
def create_category(data: CategoryRequest, _: User = Depends(admin_only), db: Session = Depends(get_db)):
    return CategoryService(db).create(data)


@router.put("/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: int,
    data: CategoryRequest,
    _: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return CategoryService(db).update(category_id, data)


@router.patch("/{category_id}/status", response_model=CategoryOut)
def set_category_status(
    category_id: int,
    data: StatusUpdateRequest,
    _: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return CategoryService(db).set_status(category_id, data.is_active)
