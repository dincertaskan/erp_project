from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum

from app.models import OrderStatus
from app.schemas.common import ApiModel


class SalesGroupBy(StrEnum):
    DAY = "day"
    WEEK = "week"
    MONTH = "month"
    PRODUCT = "product"
    CATEGORY = "category"


class SalesRow(ApiModel):
    # Zaman gruplamasında dönemin ilk günü; ürün/kategori gruplamasında boş
    period: date | None
    label: str
    order_count: int
    quantity: int
    revenue: Decimal
    cost: Decimal
    gross_profit: Decimal


class SalesTotals(ApiModel):
    order_count: int
    quantity: int
    revenue: Decimal
    cost: Decimal
    gross_profit: Decimal


class SalesReport(ApiModel):
    date_from: date
    date_to: date
    group_by: SalesGroupBy
    rows: list[SalesRow]
    totals: SalesTotals


# --- Stok raporu ---


class StockReportRow(ApiModel):
    product_id: int
    sku: str
    name: str
    category: str
    opening_stock: int
    stock_in: int
    stock_out: int
    closing_stock: int
    stock_value: Decimal
    status: str


class StockReportTotals(ApiModel):
    stock_in: int
    stock_out: int
    stock_value: Decimal


class StockReport(ApiModel):
    date_from: date
    date_to: date
    rows: list[StockReportRow]
    totals: StockReportTotals


# --- Sipariş raporu ---


class OrderReportRow(ApiModel):
    id: int
    order_code: str
    created_at: datetime
    customer: str
    item_count: int
    total_amount: Decimal
    status: OrderStatus
    approved_at: datetime | None
    shipped_at: datetime | None
    completed_at: datetime | None


class OrderReport(ApiModel):
    date_from: date
    date_to: date
    rows: list[OrderReportRow]
    total: int
    total_amount: Decimal
    page: int
    page_size: int
