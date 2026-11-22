from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import clock
from app.models import Order, OrderItem, OrderStatus, Product
from app.repositories.customer_repository import REVENUE_STATUSES
from app.repositories.stock_repository import StockRepository
from app.schemas.dashboard import DashboardSummary, Granularity, Period, TopProduct, TrendPoint

# Satış sipariş tarihine (created_at) yazılır.
# Ciroya yalnızca onaylanmış ve iptal edilmemiş siparişler girer (karar 6).
IS_REVENUE = Order.status.in_(REVENUE_STATUSES)
TREND_DAYS = 30
TREND_MONTHS = 12


class DashboardService:
    """Yönetici paneli özetleri (FR-17). Gün sınırları İstanbul saatine göredir."""

    def __init__(self, db: Session, now: datetime | None = None):
        self.db = db
        self.now = (now or clock.now()).astimezone(clock.BUSINESS_TZ)

    def _sales(self, start: datetime, end: datetime) -> tuple[Decimal, int]:
        amount, count = self.db.execute(
            select(func.coalesce(func.sum(Order.total_amount), 0), func.count()).where(
                IS_REVENUE, Order.created_at >= start, Order.created_at < end
            )
        ).one()
        return Decimal(amount), count

    def summary(self) -> DashboardSummary:
        today = clock.start_of_day(self.now)
        month_start = clock.start_of_month(self.now)
        today_sales, today_count = self._sales(today, today + timedelta(days=1))
        yesterday_sales, _ = self._sales(today - timedelta(days=1), today)
        month_sales, _ = self._sales(month_start, self.now)
        prev_month_sales, _ = self._sales(clock.add_months(month_start, -1), clock.add_months(self.now, -1))
        pending = self.db.scalar(select(func.count()).where(Order.status == OrderStatus.PENDING))
        return DashboardSummary(
            today_sales=today_sales,
            today_order_count=today_count,
            yesterday_sales=yesterday_sales,
            month_sales=month_sales,
            prev_month_sales=prev_month_sales,
            pending_orders=pending,
            critical_stock_count=StockRepository(self.db).critical_count(),
        )

    def sales_trend(self, granularity: Granularity) -> list[TrendPoint]:
        """Son 30 gün (günlük) ya da son 12 ay (aylık); satış olmayan dönemler 0 olarak döner."""
        if granularity == Granularity.DAY:
            start = clock.start_of_day(self.now) - timedelta(days=TREND_DAYS - 1)
            buckets = [(start + timedelta(days=i)).date() for i in range(TREND_DAYS)]
        else:
            start = clock.add_months(clock.start_of_month(self.now), -(TREND_MONTHS - 1))
            buckets = [clock.add_months(start, i).date() for i in range(TREND_MONTHS)]

        local_time = func.timezone(clock.BUSINESS_TZ.key, Order.created_at)
        bucket = func.date_trunc(granularity.value, local_time).label("bucket")
        rows = self.db.execute(
            select(bucket, func.sum(Order.total_amount), func.count())
            .where(IS_REVENUE, Order.created_at >= start)
            .group_by(bucket)
        ).all()
        totals: dict[date, tuple[Decimal, int]] = {row[0].date(): (Decimal(row[1]), row[2]) for row in rows}
        return [
            TrendPoint(date=day, amount=totals.get(day, (Decimal("0"), 0))[0], order_count=totals.get(day, (0, 0))[1])
            for day in buckets
        ]

    def period_start(self, period: Period) -> datetime:
        if period == Period.TODAY:
            return clock.start_of_day(self.now)
        if period == Period.WEEK:
            return clock.start_of_week(self.now)
        return clock.start_of_month(self.now)

    def top_products(self, period: Period, limit: int) -> list[TopProduct]:
        quantity = func.sum(OrderItem.quantity).label("quantity")
        revenue = func.sum(OrderItem.line_total).label("revenue")
        rows = self.db.execute(
            select(Product.id, Product.sku, Product.name, quantity, revenue)
            .join(OrderItem, OrderItem.product_id == Product.id)
            .join(Order, Order.id == OrderItem.order_id)
            .where(IS_REVENUE, Order.created_at >= self.period_start(period))
            .group_by(Product.id)
            .order_by(quantity.desc(), revenue.desc(), Product.id)
            .limit(limit)
        ).all()
        return [TopProduct(product_id=row[0], sku=row[1], name=row[2], quantity=row[3], revenue=row[4]) for row in rows]
