from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles
from app.models import OrderStatus, User, UserRole
from app.repositories.order_repository import OrderFilters
from app.schemas.common import PageParams
from app.schemas.order import OrderAction, OrderCreateRequest, OrderDetail, OrderPage
from app.services.order_service import OrderService

router = APIRouter(prefix="/orders", tags=["Siparişler"])

staff = require_roles(UserRole.ADMIN, UserRole.WAREHOUSE)
admin_only = require_roles(UserRole.ADMIN)


@router.get("", response_model=OrderPage)
def list_orders(
    page: PageParams = Depends(),
    status: list[OrderStatus] = Query(default=[]),
    search: str | None = Query(None, max_length=100, description="Sipariş kodu ya da müşteri adı"),
    customer_id: int | None = None,
    date_from: datetime | None = Query(None, alias="from"),
    date_to: datetime | None = Query(None, alias="to"),
    viewer: User = Depends(staff),
    db: Session = Depends(get_db),
):
    """Depo personeli yalnızca Hazırlanıyor ve Kargolandı durumundaki siparişleri görür."""
    filters = OrderFilters(
        statuses=status or None, search=search, customer_id=customer_id, date_from=date_from, date_to=date_to
    )
    return OrderService(db).list(viewer, page, filters)


@router.post("", response_model=OrderDetail, status_code=201)
def create_order(data: OrderCreateRequest, actor: User = Depends(admin_only), db: Session = Depends(get_db)):
    """Müşteri adına sipariş girişi. Sipariş Onay Bekliyor durumunda oluşur; stok onayda düşülür.
    Stok yetmeyen kalemler engellenmez, yanıttaki `shortages` alanında bildirilir."""
    return OrderService(db).create(actor, data)


@router.get("/{order_id}", response_model=OrderDetail)
def get_order(order_id: int, viewer: User = Depends(staff), db: Session = Depends(get_db)):
    return OrderService(db).detail(viewer, order_id)


@router.post("/{order_id}/approve", response_model=OrderDetail)
def approve_order(order_id: int, actor: User = Depends(admin_only), db: Session = Depends(get_db)):
    """Tüm kalemlerin stoğu tek işlemde düşülür; bir kalemde bile stok yetmezse 409 ve tüm eksikler döner."""
    return OrderService(db).transition(actor, order_id, OrderAction.APPROVE)


@router.post("/{order_id}/ship", response_model=OrderDetail)
def ship_order(order_id: int, actor: User = Depends(staff), db: Session = Depends(get_db)):
    return OrderService(db).transition(actor, order_id, OrderAction.SHIP)


@router.post("/{order_id}/complete", response_model=OrderDetail)
def complete_order(order_id: int, actor: User = Depends(admin_only), db: Session = Depends(get_db)):
    return OrderService(db).transition(actor, order_id, OrderAction.COMPLETE)


@router.post("/{order_id}/cancel", response_model=OrderDetail)
def cancel_order(order_id: int, actor: User = Depends(admin_only), db: Session = Depends(get_db)):
    """Hazırlanan bir sipariş iptal edilirse düşülen stok geri eklenir."""
    return OrderService(db).transition(actor, order_id, OrderAction.CANCEL)
