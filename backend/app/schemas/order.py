from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from pydantic import Field, field_validator

from app.models import OrderStatus, PaymentMethod, RecordSource
from app.schemas.catalog import MovementOut
from app.schemas.common import ApiModel, Page, RequestModel
from app.schemas.stock import ProductRef


class OrderAction(StrEnum):
    APPROVE = "approve"
    SHIP = "ship"
    COMPLETE = "complete"
    CANCEL = "cancel"


# --- İstekler ---


class OrderItemRequest(RequestModel):
    product_id: int
    quantity: int = Field(gt=0, le=10_000)


class OrderCreateRequest(RequestModel):
    customer_id: int
    items: list[OrderItemRequest] = Field(min_length=1, max_length=100)
    payment_method: PaymentMethod
    # Boş bırakılırsa müşterinin kayıtlı adresi kullanılır.
    shipping_address: str | None = Field(None, max_length=1000)
    note: str | None = Field(None, max_length=1000)

    @field_validator("items")
    @classmethod
    def unique_products(cls, items: list[OrderItemRequest]) -> list[OrderItemRequest]:
        ids = [item.product_id for item in items]
        if len(ids) != len(set(ids)):
            raise ValueError("Aynı ürün siparişe birden fazla kez eklenemez; adedi artırın.")
        return items


# --- Yanıtlar ---


class CustomerRef(ApiModel):
    id: int
    full_name: str


class CustomerCard(CustomerRef):
    email: str
    phone: str | None
    company_name: str | None
    address: str | None
    city: str | None


class Shortage(ApiModel):
    product_id: int
    sku: str
    name: str
    requested: int
    available: int


class OrderListItem(ApiModel):
    id: int
    order_code: str
    created_at: datetime
    status: OrderStatus
    customer: CustomerRef
    item_count: int
    total_amount: Decimal
    payment_method: PaymentMethod
    source: RecordSource
    allowed_actions: list[OrderAction]


class OrderPage(Page[OrderListItem]):
    counts_by_status: dict[OrderStatus, int]


class OrderItemProduct(ProductRef):
    image_url: str | None
    stock: int


class OrderItemOut(ApiModel):
    id: int
    product: OrderItemProduct
    quantity: int
    unit_price: Decimal
    line_total: Decimal


class UserRef(ApiModel):
    id: int
    full_name: str


class StatusHistoryOut(ApiModel):
    from_status: OrderStatus | None
    to_status: OrderStatus
    changed_at: datetime
    changed_by: UserRef | None


class OrderMovementOut(MovementOut):
    product: ProductRef


class OrderDetail(OrderListItem):
    customer: CustomerCard
    shipping_address: str | None
    note: str | None
    created_by: UserRef | None
    approved_at: datetime | None
    shipped_at: datetime | None
    completed_at: datetime | None
    cancelled_at: datetime | None
    items: list[OrderItemOut]
    history: list[StatusHistoryOut]
    movements: list[OrderMovementOut]
    # Onay bekleyen siparişte stoğu yetmeyen kalemler (onaydan önce uyarı için)
    shortages: list[Shortage]
