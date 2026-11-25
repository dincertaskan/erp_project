"""Stok raporu ve sipariş raporu (FR-18)."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import and_, case, func, select
from sqlalchemy.orm import Session

from app.core import clock
from app.models import Category, Customer, Order, OrderStatus, Product, StockMovement, StockMovementType
from app.repositories.order_repository import item_count_column
from app.schemas.catalog import stock_status
from app.schemas.report import (
    OrderReport,
    OrderReportRow,
    StockReport,
    StockReportRow,
    StockReportTotals,
)
from app.services.report_service import local_bounds
from app.services.xlsx import build_xlsx

ZERO = Decimal("0")
INCOMING = (StockMovementType.IN, StockMovementType.CANCEL_RETURN)
STOCK_STATUS_TR = {"sufficient": "Yeterli", "critical": "Kritik", "out_of_stock": "Tükendi"}
ORDER_STATUS_TR = {
    OrderStatus.PENDING: "Onay Bekliyor",
    OrderStatus.PREPARING: "Hazırlanıyor",
    OrderStatus.SHIPPED: "Kargolandı",
    OrderStatus.COMPLETED: "Tamamlandı",
    OrderStatus.CANCELLED: "İptal",
}
ORDER_REPORT_LIMIT = 10_000


def _local(value: datetime | None) -> datetime | None:
    return value.astimezone(clock.BUSINESS_TZ) if value else None


class StockReportService:
    """Dönem başı/sonu stok ve dönem içi giriş-çıkışlar.

    Her stok değişikliği bir hareket kaydı bıraktığı için geçmiş stok, bugünkü stoktan bitişten sonraki
    hareketler geri alınarak bulunur. Stok değeri ürünün güncel maliyetiyle hesaplanır.
    """

    def __init__(self, db: Session):
        self.db = db

    def build(self, date_from: date, date_to: date, category_id: int | None = None) -> StockReport:
        start, end = local_bounds(date_from, date_to)
        incoming = StockMovement.movement_type.in_(INCOMING)
        signed = case((incoming, StockMovement.quantity), else_=-StockMovement.quantity)
        in_period = and_(StockMovement.created_at >= start, StockMovement.created_at < end)
        movements = (
            select(
                StockMovement.product_id.label("product_id"),
                func.sum(StockMovement.quantity).filter(in_period, incoming).label("stock_in"),
                func.sum(StockMovement.quantity).filter(in_period, ~incoming).label("stock_out"),
                func.sum(signed).filter(StockMovement.created_at >= end).label("after_end"),
            )
            .group_by(StockMovement.product_id)
            .subquery()
        )
        query = (
            select(
                Product,
                Category.name,
                func.coalesce(movements.c.stock_in, 0),
                func.coalesce(movements.c.stock_out, 0),
                func.coalesce(movements.c.after_end, 0),
            )
            .join(Category, Category.id == Product.category_id)
            .outerjoin(movements, movements.c.product_id == Product.id)
            .where(Product.is_active.is_(True))
            .order_by(Category.name, Product.name)
        )
        if category_id is not None:
            query = query.where(Product.category_id == category_id)

        rows = []
        for product, category, stock_in, stock_out, after_end in self.db.execute(query).all():
            closing = product.stock - after_end
            rows.append(
                StockReportRow(
                    product_id=product.id,
                    sku=product.sku,
                    name=product.name,
                    category=category,
                    opening_stock=closing - stock_in + stock_out,
                    stock_in=stock_in,
                    stock_out=stock_out,
                    closing_stock=closing,
                    stock_value=(product.cost_price * closing).quantize(Decimal("0.01")),
                    status=STOCK_STATUS_TR[stock_status(closing, product.min_stock).value],
                )
            )
        totals = StockReportTotals(
            stock_in=sum(r.stock_in for r in rows),
            stock_out=sum(r.stock_out for r in rows),
            stock_value=sum((r.stock_value for r in rows), ZERO),
        )
        return StockReport(date_from=date_from, date_to=date_to, rows=rows, totals=totals)


class OrderReportService:
    """Tarih aralığındaki siparişler ve durum tarihleri."""

    def __init__(self, db: Session):
        self.db = db

    def build(
        self,
        date_from: date,
        date_to: date,
        statuses: list[OrderStatus],
        *,
        page: int = 1,
        page_size: int = ORDER_REPORT_LIMIT,
    ) -> OrderReport:
        start, end = local_bounds(date_from, date_to)
        query = select(Order).where(Order.created_at >= start, Order.created_at < end)
        if statuses:
            query = query.where(Order.status.in_(statuses))
        total, total_amount = self.db.execute(
            select(func.count(), func.coalesce(func.sum(query.subquery().c.total_amount), 0))
        ).one()
        rows = self.db.execute(
            query.add_columns(Customer.full_name, item_count_column())
            .join(Customer, Customer.id == Order.customer_id)
            .order_by(Order.created_at.desc(), Order.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
        return OrderReport(
            date_from=date_from,
            date_to=date_to,
            rows=[
                OrderReportRow(
                    id=order.id,
                    order_code=order.order_code,
                    created_at=_local(order.created_at),
                    customer=customer,
                    item_count=item_count,
                    total_amount=order.total_amount,
                    status=order.status,
                    approved_at=_local(order.approved_at),
                    shipped_at=_local(order.shipped_at),
                    completed_at=_local(order.completed_at),
                )
                for order, customer, item_count in rows
            ],
            total=total,
            total_amount=Decimal(total_amount),
            page=page,
            page_size=page_size,
        )


def stock_report_xlsx(report: StockReport) -> bytes:
    t = report.totals
    return build_xlsx(
        sheet_title="Stok Raporu",
        title=f"Stok Raporu · {report.date_from:%d.%m.%Y} – {report.date_to:%d.%m.%Y}",
        note="Çıkış, sipariş çıkışlarını ve elle çıkışları kapsar. Stok değeri güncel maliyetle hesaplanmıştır.",
        headers=["SKU", "Ürün", "Kategori", "Dönem Başı", "Giriş", "Çıkış", "Dönem Sonu", "Stok Değeri", "Durum"],
        rows=(
            [
                r.sku,
                r.name,
                r.category,
                r.opening_stock,
                r.stock_in,
                r.stock_out,
                r.closing_stock,
                r.stock_value,
                r.status,
            ]
            for r in report.rows
        ),
        total_row=["Toplam", "", "", "", t.stock_in, t.stock_out, "", t.stock_value, ""],
        money_columns={8},
        widths=[14, 34, 18, 12, 10, 10, 12, 16, 12],
    )


def _thousands(value: int) -> str:
    return f"{value:,}".replace(",", ".")


def order_report_xlsx(report: OrderReport) -> bytes:
    # Dosya en fazla ORDER_REPORT_LIMIT satır içerir; kesildiyse not satırı bunu açıkça belirtir.
    truncated = report.total > len(report.rows)
    if truncated:
        note = (
            f"İlk {_thousands(len(report.rows))} sipariş gösterildi; toplam {_thousands(report.total)} sipariş. "
            "Tarihler İstanbul saatine göredir."
        )
        total_label = f"Toplam ({_thousands(report.total)} siparişin tamamı)"
    else:
        note = f"{report.total} sipariş. Tarihler İstanbul saatine göredir."
        total_label = "Toplam"
    return build_xlsx(
        sheet_title="Sipariş Raporu",
        title=f"Sipariş Raporu · {report.date_from:%d.%m.%Y} – {report.date_to:%d.%m.%Y}",
        note=note,
        headers=[
            "Sipariş Kodu",
            "Tarih",
            "Müşteri",
            "Kalem",
            "Tutar",
            "Durum",
            "Onay Tarihi",
            "Kargo Tarihi",
            "Teslim Tarihi",
        ],
        rows=(
            [
                r.order_code,
                r.created_at,
                r.customer,
                r.item_count,
                r.total_amount,
                ORDER_STATUS_TR[r.status],
                r.approved_at,
                r.shipped_at,
                r.completed_at,
            ]
            for r in report.rows
        ),
        total_row=[total_label, "", "", "", report.total_amount, "", "", "", ""],
        money_columns={5},
        widths=[18, 17, 24, 8, 16, 14, 17, 17, 17],
    )
