from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from pydantic import Field, field_validator

from app.models import OrderStatus, PaymentMethod
from app.schemas.catalog import CategoryRef
from app.schemas.common import ApiModel, Page, RequestModel

# Bu sayının altındaki stok müşteriye "Son N ürün" olarak gösterilir.
LOW_STOCK_THRESHOLD = 5


class Availability(StrEnum):
    IN_STOCK = "in_stock"
    LOW_STOCK = "low_stock"
    OUT_OF_STOCK = "out_of_stock"


def availability(stock: int) -> Availability:
    if stock <= 0:
        return Availability.OUT_OF_STOCK
    if stock <= LOW_STOCK_THRESHOLD:
        return Availability.LOW_STOCK
    return Availability.IN_STOCK


class CatalogSort(StrEnum):
    RECOMMENDED = "recommended"
    PRICE_ASC = "price_asc"
    PRICE_DESC = "price_desc"
    NEWEST = "newest"
    NAME = "name"


class CatalogCategory(CategoryRef):
    product_count: int


class CatalogProduct(ApiModel):
    """Müşteriye gösterilen ürün: maliyet yok, stok yalnızca sepete eklenebilecek miktar olarak."""

    id: int
    sku: str
    name: str
    description: str | None
    category: CategoryRef
    sale_price: Decimal
    image_url: str | None
    availability: Availability
    available_qty: int


class CatalogProductDetail(CatalogProduct):
    related: list[CatalogProduct]


class CatalogPage(Page[CatalogProduct]):
    min_price: Decimal | None
    max_price: Decimal | None


# --- Sepet ve sipariş ---


class CartLine(RequestModel):
    product_id: int
    quantity: int = Field(gt=0, le=10_000)
    # Müşterinin sepete eklerken gördüğü fiyat; değiştiyse sipariş oluşturulmaz.
    expected_price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)


def _unique(lines: list[CartLine]) -> list[CartLine]:
    ids = [line.product_id for line in lines]
    if len(ids) != len(set(ids)):
        raise ValueError("Aynı ürün sepette birden fazla satırda olamaz.")
    return lines


class CartValidateRequest(RequestModel):
    items: list[CartLine] = Field(min_length=1, max_length=100)

    @field_validator("items")
    @classmethod
    def unique_products(cls, items: list[CartLine]) -> list[CartLine]:
        return _unique(items)


class ShopOrderRequest(CartValidateRequest):
    payment_method: PaymentMethod
    shipping_address: str = Field(min_length=5, max_length=1000)
    note: str | None = Field(None, max_length=1000)


class CartIssueType(StrEnum):
    NOT_AVAILABLE = "not_available"
    PRICE_CHANGED = "price_changed"
    INSUFFICIENT_STOCK = "insufficient_stock"


class CartIssue(ApiModel):
    product_id: int
    issue: CartIssueType
    message: str
    old_price: Decimal | None = None
    new_price: Decimal | None = None
    available_qty: int | None = None


class CartValidation(ApiModel):
    products: list[CatalogProduct]
    issues: list[CartIssue]


class StatusGroup(StrEnum):
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class MyOrderItem(ApiModel):
    product_id: int
    sku: str
    name: str
    image_url: str | None
    quantity: int
    unit_price: Decimal
    line_total: Decimal


class MyOrderSummary(ApiModel):
    id: int
    order_code: str
    created_at: datetime
    status: OrderStatus
    total_amount: Decimal
    item_count: int
    preview: list[MyOrderItem]
    can_cancel: bool


class MyStatusStep(ApiModel):
    status: OrderStatus
    at: datetime


class MyOrderDetail(MyOrderSummary):
    items: list[MyOrderItem]
    payment_method: PaymentMethod
    shipping_address: str | None
    note: str | None
    # Personel adları müşteriye gösterilmez; yalnızca durum ve tarih.
    timeline: list[MyStatusStep]
