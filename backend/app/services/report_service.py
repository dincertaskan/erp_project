from __future__ import annotations

from datetime import date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import clock
from app.core.errors import AppError
from app.models import Category, Order, OrderItem, Product
from app.repositories.customer_repository import REVENUE_STATUSES
from app.schemas.report import SalesGroupBy, SalesReport, SalesRow, SalesTotals
from app.services.xlsx import build_xlsx

MAX_RANGE_DAYS = 3 * 366
MONTHS_TR = [
    "Ocak",
    "Şubat",
    "Mart",
    "Nisan",
    "Mayıs",
    "Haziran",
    "Temmuz",
    "Ağustos",
    "Eylül",
    "Ekim",
    "Kasım",
    "Aralık",
]
TIME_GROUPS = {SalesGroupBy.DAY, SalesGroupBy.WEEK, SalesGroupBy.MONTH}
ZERO = Decimal("0")


def local_bounds(date_from: date, date_to: date) -> tuple[datetime, datetime]:
    """İki ucu da dahil tarih aralığı; İstanbul saatine göre [başlangıç, bitiş+1 gün)."""
    if date_from > date_to:
        raise AppError("Başlangıç tarihi bitiş tarihinden sonra olamaz.", code="INVALID_RANGE")
    if (date_to - date_from).days > MAX_RANGE_DAYS:
        raise AppError("Rapor aralığı en fazla 3 yıl olabilir.", code="INVALID_RANGE")
    start = datetime.combine(date_from, time.min, tzinfo=clock.BUSINESS_TZ)
    end = datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=clock.BUSINESS_TZ)
    return start, end


def _period_label(period: date, group_by: SalesGroupBy) -> str:
    if group_by == SalesGroupBy.MONTH:
        return f"{MONTHS_TR[period.month - 1]} {period.year}"
    if group_by == SalesGroupBy.WEEK:
        return f"{period:%d.%m.%Y} haftası"
    return f"{period:%d.%m.%Y}"


def _periods(date_from: date, date_to: date, group_by: SalesGroupBy) -> list[date]:
    """Aralıktaki tüm dönemler; satış olmayan dönemler raporda 0 olarak görünür."""
    if group_by == SalesGroupBy.DAY:
        start, step = date_from, timedelta(days=1)
    elif group_by == SalesGroupBy.WEEK:
        start, step = date_from - timedelta(days=date_from.weekday()), timedelta(days=7)
    else:
        start = date_from.replace(day=1)
        periods = []
        while start <= date_to:
            periods.append(start)
            start = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
        return periods
    periods = []
    while start <= date_to:
        periods.append(start)
        start += step
    return periods


class ReportService:
    """Satış raporu (FR-18). Ciro: onaylanmış ve iptal edilmemiş siparişler, sipariş tarihine göre (karar 6).
    Maliyet ürünün güncel maliyetiyle hesaplanır; sipariş anındaki maliyet saklanmaz."""

    def __init__(self, db: Session):
        self.db = db

    def sales(
        self, date_from: date, date_to: date, group_by: SalesGroupBy, category_id: int | None = None
    ) -> SalesReport:
        start, end = local_bounds(date_from, date_to)

        if group_by in TIME_GROUPS:
            local_time = func.timezone(clock.BUSINESS_TZ.key, Order.created_at)
            key = func.date_trunc(group_by.value, local_time)
            label_columns = [key]
        elif group_by == SalesGroupBy.PRODUCT:
            key = Product.id
            label_columns = [Product.id, Product.sku, Product.name]
        else:
            key = Category.id
            label_columns = [Category.id, Category.name]

        quantity = func.sum(OrderItem.quantity)
        revenue = func.sum(OrderItem.line_total)
        cost = func.sum(OrderItem.quantity * Product.cost_price)
        query = (
            select(*label_columns, func.count(func.distinct(Order.id)), quantity, revenue, cost)
            .select_from(OrderItem)
            .join(Order, Order.id == OrderItem.order_id)
            .join(Product, Product.id == OrderItem.product_id)
            .join(Category, Category.id == Product.category_id)
            .where(Order.status.in_(REVENUE_STATUSES), Order.created_at >= start, Order.created_at < end)
            .group_by(*label_columns)
        )
        if category_id is not None:
            query = query.where(Product.category_id == category_id)
        rows = self.db.execute(query).all()

        report_rows: list[SalesRow] = []
        if group_by in TIME_GROUPS:
            found = {row[0].date(): row[1:] for row in rows}
            for period in _periods(date_from, date_to, group_by):
                count, qty, rev, cst = found.get(period, (0, 0, ZERO, ZERO))
                report_rows.append(self._row(period, _period_label(period, group_by), count, qty, rev, cst))
        else:
            for row in rows:
                label = f"{row[1]} · {row[2]}" if group_by == SalesGroupBy.PRODUCT else row[1]
                report_rows.append(self._row(None, label, *row[-4:]))
            report_rows.sort(key=lambda r: r.revenue, reverse=True)

        # Ürün/kategori satırlarında bir sipariş birden fazla satıra girebilir; toplam sipariş sayısı ayrıca sayılır.
        orders_query = (
            select(func.count(func.distinct(Order.id)))
            .select_from(OrderItem)
            .join(Order, Order.id == OrderItem.order_id)
            .join(Product, Product.id == OrderItem.product_id)
            .where(Order.status.in_(REVENUE_STATUSES), Order.created_at >= start, Order.created_at < end)
        )
        if category_id is not None:
            orders_query = orders_query.where(Product.category_id == category_id)
        total_orders = self.db.scalar(orders_query)
        totals = SalesTotals(
            order_count=total_orders,
            quantity=sum(r.quantity for r in report_rows),
            revenue=sum((r.revenue for r in report_rows), ZERO),
            cost=sum((r.cost for r in report_rows), ZERO),
            gross_profit=sum((r.gross_profit for r in report_rows), ZERO),
        )
        return SalesReport(date_from=date_from, date_to=date_to, group_by=group_by, rows=report_rows, totals=totals)

    @staticmethod
    def _row(period, label, order_count, quantity, revenue, cost) -> SalesRow:
        revenue, cost = Decimal(revenue or 0), Decimal(cost or 0).quantize(Decimal("0.01"))
        return SalesRow(
            period=period,
            label=label,
            order_count=order_count or 0,
            quantity=quantity or 0,
            revenue=revenue,
            cost=cost,
            gross_profit=revenue - cost,
        )


GROUP_TITLES = {
    SalesGroupBy.DAY: "Gün",
    SalesGroupBy.WEEK: "Hafta",
    SalesGroupBy.MONTH: "Ay",
    SalesGroupBy.PRODUCT: "Ürün",
    SalesGroupBy.CATEGORY: "Kategori",
}


def sales_report_xlsx(report: SalesReport) -> bytes:
    t = report.totals
    return build_xlsx(
        sheet_title="Satış Raporu",
        title=f"Satış Raporu · {report.date_from:%d.%m.%Y} – {report.date_to:%d.%m.%Y}",
        note="Ciro: onaylanmış ve iptal edilmemiş siparişler. Maliyet ürünlerin güncel maliyetiyle hesaplanmıştır.",
        headers=[GROUP_TITLES[report.group_by], "Sipariş Sayısı", "Satılan Adet", "Ciro", "Maliyet", "Brüt Kâr"],
        rows=([r.label, r.order_count, r.quantity, r.revenue, r.cost, r.gross_profit] for r in report.rows),
        total_row=["Toplam", t.order_count, t.quantity, t.revenue, t.cost, t.gross_profit],
        money_columns={4, 5, 6},
        widths=[34, 16, 14, 18, 18, 18],
    )
