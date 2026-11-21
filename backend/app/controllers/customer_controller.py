from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles
from app.models import Customer, User, UserRole
from app.schemas.common import Page, PageParams
from app.schemas.customer import CustomerListItem

router = APIRouter(prefix="/customers", tags=["Müşteriler"])

admin_only = require_roles(UserRole.ADMIN)


@router.get("", response_model=Page[CustomerListItem])
def list_customers(
    page: PageParams = Depends(),
    search: str | None = Query(None, max_length=100),
    is_active: bool | None = None,
    _: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    """Ad, e-posta ya da firma adına göre arama (sipariş girişindeki müşteri seçimi de bunu kullanır)."""
    query = select(Customer)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(Customer.full_name.ilike(pattern), Customer.email.ilike(pattern), Customer.company_name.ilike(pattern))
        )
    if is_active is not None:
        query = query.where(Customer.is_active.is_(is_active))
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    customers = db.scalars(query.order_by(Customer.full_name, Customer.id).offset(page.offset).limit(page.page_size))
    return Page[CustomerListItem](
        items=[CustomerListItem.model_validate(c) for c in customers],
        total=total,
        page=page.page,
        page_size=page.page_size,
    )
