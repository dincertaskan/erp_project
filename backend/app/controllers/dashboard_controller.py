from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles
from app.core.routing import SessionReleasingRoute
from app.models import User, UserRole
from app.schemas.dashboard import DashboardSummary, Granularity, Period, TopProduct, TrendPoint
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"], route_class=SessionReleasingRoute)

admin_only = require_roles(UserRole.ADMIN)

# Kritik stok ve son siparişler için ayrı uç yoktur: /stock/critical ve /orders kullanılır.


@router.get("/summary", response_model=DashboardSummary)
def summary(_: User = Depends(admin_only), db: Session = Depends(get_db)):
    """Satışlar onaylanmış ve iptal edilmemiş siparişlerden, sipariş tarihine göre hesaplanır."""
    return DashboardService(db).summary()


@router.get("/sales-trend", response_model=list[TrendPoint])
def sales_trend(
    granularity: Granularity = Granularity.DAY,
    _: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return DashboardService(db).sales_trend(granularity)


@router.get("/top-products", response_model=list[TopProduct])
def top_products(
    period: Period = Period.MONTH,
    limit: int = Query(5, ge=1, le=20),
    _: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return DashboardService(db).top_products(period, limit)
