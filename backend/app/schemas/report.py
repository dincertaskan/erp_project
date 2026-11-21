from datetime import date
from decimal import Decimal
from enum import StrEnum

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
