from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles
from app.models import StockMovementType, User, UserRole
from app.schemas.common import Page, PageParams
from app.schemas.stock import (
    CriticalCount,
    CriticalProductOut,
    MovementFilters,
    MovementListItem,
    StockMovementRequest,
    StockMovementResult,
    StockSummary,
)
from app.services.stock_service import StockService

router = APIRouter(prefix="/stock", tags=["Stok"])

staff = require_roles(UserRole.ADMIN, UserRole.WAREHOUSE)


@router.post("/movements", response_model=StockMovementResult, status_code=201)
def record_movement(data: StockMovementRequest, actor: User = Depends(staff), db: Session = Depends(get_db)):
    """Elle stok girişi ya da çıkışı. İşlemi yapan kişi oturumdan alınır; yetersiz stokta 409 döner."""
    return StockService(db).record(actor, data)


@router.get("/movements", response_model=Page[MovementListItem])
def list_movements(
    page: PageParams = Depends(),
    date_from: datetime | None = Query(None, alias="from"),
    date_to: datetime | None = Query(None, alias="to"),
    product_id: int | None = None,
    type: list[StockMovementType] = Query(default=[]),
    user_id: int | None = None,
    order_code: str | None = Query(None, max_length=40),
    _: User = Depends(staff),
    db: Session = Depends(get_db),
):
    filters = MovementFilters(
        date_from=date_from,
        date_to=date_to,
        product_id=product_id,
        types=type,
        user_id=user_id,
        order_code=order_code,
    )
    return StockService(db).movements(filters, page)


@router.get("/critical", response_model=Page[CriticalProductOut])
def critical_products(
    page: PageParams = Depends(),
    category_id: list[int] = Query(default=[]),
    _: User = Depends(staff),
    db: Session = Depends(get_db),
):
    """Stoğu minimumun altındaki aktif ürünler, en kritik olan önce."""
    return StockService(db).critical(page, category_ids=category_id)


@router.get("/critical/count", response_model=CriticalCount)
def critical_count(_: User = Depends(staff), db: Session = Depends(get_db)):
    return CriticalCount(count=StockService(db).critical_count())


@router.get("/summary", response_model=StockSummary)
def stock_summary(_: User = Depends(staff), db: Session = Depends(get_db)):
    return StockService(db).summary()
