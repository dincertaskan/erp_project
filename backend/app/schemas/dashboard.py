from datetime import date
from decimal import Decimal
from enum import StrEnum

from app.schemas.common import ApiModel


class Period(StrEnum):
    TODAY = "today"
    WEEK = "week"
    MONTH = "month"


class Granularity(StrEnum):
    DAY = "day"
    MONTH = "month"


class DashboardSummary(ApiModel):
    today_sales: Decimal
    today_order_count: int
    yesterday_sales: Decimal
    # Ayın başından bugüne; karşılaştırma geçen ayın aynı gün aralığıyla yapılır.
    month_sales: Decimal
    prev_month_sales: Decimal
    pending_orders: int
    critical_stock_count: int


class TrendPoint(ApiModel):
    date: date
    amount: Decimal
    order_count: int


class TopProduct(ApiModel):
    product_id: int
    sku: str
    name: str
    quantity: int
    revenue: Decimal
