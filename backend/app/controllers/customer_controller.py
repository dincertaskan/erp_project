from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles
from app.models import OrderStatus, User, UserRole
from app.repositories.customer_repository import CustomerFilters
from app.repositories.order_repository import OrderFilters
from app.schemas.common import Page, PageParams
from app.schemas.customer import CustomerDetail, CustomerListItem, CustomerOrder, CustomerRequest, CustomerSort
from app.schemas.user import StatusUpdateRequest
from app.services.customer_service import CustomerService

router = APIRouter(prefix="/customers", tags=["Müşteriler"])

admin_only = require_roles(UserRole.ADMIN)

SORT_PATTERN = r"^-?(" + "|".join(s.value for s in CustomerSort) + r")$"


@router.get("", response_model=Page[CustomerListItem])
def list_customers(
    page: PageParams = Depends(),
    search: str | None = Query(None, max_length=100, description="Ad, e-posta, telefon ya da firma"),
    city: str | None = Query(None, max_length=100),
    is_active: bool | None = None,
    has_account: bool | None = None,
    sort: str = Query("full_name", pattern=SORT_PATTERN),
    _: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    """Sipariş sayısı, toplam harcama (onaylanmış ve iptal edilmemiş siparişler) ve son sipariş tarihiyle."""
    filters = CustomerFilters(search=search, city=city, is_active=is_active, has_account=has_account)
    return CustomerService(db).list(page, filters, sort=CustomerSort(sort.lstrip("-")), descending=sort.startswith("-"))


@router.get("/cities", response_model=list[str])
def list_cities(_: User = Depends(admin_only), db: Session = Depends(get_db)):
    """Şehir filtresi için kayıtlı şehirler."""
    return CustomerService(db).cities()


@router.post("", response_model=CustomerDetail, status_code=201)
def create_customer(data: CustomerRequest, _: User = Depends(admin_only), db: Session = Depends(get_db)):
    return CustomerService(db).create(data)


@router.get("/{customer_id}", response_model=CustomerDetail)
def get_customer(customer_id: int, _: User = Depends(admin_only), db: Session = Depends(get_db)):
    return CustomerService(db).detail(customer_id)


@router.put("/{customer_id}", response_model=CustomerDetail)
def update_customer(
    customer_id: int, data: CustomerRequest, _: User = Depends(admin_only), db: Session = Depends(get_db)
):
    """Giriş hesabı olan müşterinin e-postası değiştirilemez."""
    return CustomerService(db).update(customer_id, data)


@router.patch("/{customer_id}/status", response_model=CustomerDetail)
def set_customer_status(
    customer_id: int, data: StatusUpdateRequest, _: User = Depends(admin_only), db: Session = Depends(get_db)
):
    return CustomerService(db).set_status(customer_id, data.is_active)


@router.get("/{customer_id}/orders", response_model=Page[CustomerOrder])
def customer_orders(
    customer_id: int,
    page: PageParams = Depends(),
    status: list[OrderStatus] = Query(default=[]),
    date_from: datetime | None = Query(None, alias="from"),
    date_to: datetime | None = Query(None, alias="to"),
    _: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    filters = OrderFilters(statuses=status or None, date_from=date_from, date_to=date_to)
    return CustomerService(db).orders(customer_id, page, filters)
