from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from pydantic import EmailStr, Field, field_validator

from app.models import OrderStatus, RecordSource
from app.schemas.common import ApiModel, RequestModel


class CustomerSort(StrEnum):
    FULL_NAME = "full_name"
    CREATED_AT = "created_at"
    ORDER_COUNT = "order_count"
    TOTAL_SPENT = "total_spent"
    LAST_ORDER_AT = "last_order_at"


class CustomerListItem(ApiModel):
    id: int
    full_name: str
    email: str
    phone: str | None
    company_name: str | None
    address: str | None
    city: str | None
    is_active: bool
    source: RecordSource
    created_at: datetime
    has_account: bool = False
    order_count: int = 0
    # Karar 6: yalnızca onaylanmış ve iptal edilmemiş siparişler
    total_spent: Decimal = Decimal("0")
    last_order_at: datetime | None = None


class CustomerStats(ApiModel):
    order_count: int
    revenue_order_count: int
    total_spent: Decimal
    average_basket: Decimal
    last_order_at: datetime | None


class CustomerDetail(CustomerListItem):
    stats: CustomerStats


class CustomerRequest(RequestModel):
    full_name: str = Field(min_length=2, max_length=150)
    email: EmailStr = Field(max_length=255)
    phone: str | None = Field(None, max_length=30)
    company_name: str | None = Field(None, max_length=150)
    address: str | None = Field(None, max_length=1000)
    city: str | None = Field(None, max_length=100)
    is_active: bool = True

    @field_validator("email")
    @classmethod
    def lower_email(cls, value: str) -> str:
        return value.lower()

    @field_validator("phone", "company_name", "address", "city")
    @classmethod
    def empty_to_none(cls, value: str | None) -> str | None:
        return value or None


class CustomerOrder(ApiModel):
    id: int
    order_code: str
    created_at: datetime
    item_count: int
    total_amount: Decimal
    status: OrderStatus
