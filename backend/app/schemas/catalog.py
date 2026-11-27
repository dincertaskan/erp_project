import re
from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from pydantic import Field, field_validator

from app.models import StockMovementType
from app.schemas.common import ApiModel, RequestModel

HEX_COLOR = re.compile(r"^#[0-9A-Fa-f]{6}$")
SKU_PATTERN = re.compile(r"^[A-Z0-9][A-Z0-9-]{1,63}$")
Money = Field(ge=0, max_digits=12, decimal_places=2)


class StockStatus(StrEnum):
    SUFFICIENT = "sufficient"
    CRITICAL = "critical"
    OUT_OF_STOCK = "out_of_stock"


def stock_status(stock: int, min_stock: int) -> StockStatus:
    """stock_repository'deki tanımların Python karşılığı: stok 0 ise tükendi, 0 < stok < minimum ise kritik.

    Önyüzdeki getStockStatus de aynı kuralı uygular.
    """
    if stock <= 0:
        return StockStatus.OUT_OF_STOCK
    if stock < min_stock:
        return StockStatus.CRITICAL
    return StockStatus.SUFFICIENT


# --- Kategoriler ---


class CategoryRef(ApiModel):
    id: int
    name: str
    color: str


class CategoryOut(CategoryRef):
    is_active: bool
    created_at: datetime
    product_count: int = 0


class CategoryRequest(RequestModel):
    name: str = Field(min_length=2, max_length=100)
    color: str = "#4F46E5"
    is_active: bool = True

    @field_validator("color")
    @classmethod
    def valid_color(cls, value: str) -> str:
        if not HEX_COLOR.match(value):
            raise ValueError("Renk #RRGGBB biçiminde olmalıdır.")
        return value.upper()


# --- Ürünler ---


class ProductOut(ApiModel):
    """Personelin gördüğü ürün bilgisi. Maliyet yalnızca yöneticiye gönderilir (karar 9)."""

    id: int
    sku: str
    name: str
    description: str | None
    category: CategoryRef
    sale_price: Decimal
    stock: int
    min_stock: int
    stock_status: StockStatus
    image_url: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    last_movement_at: datetime | None = None


class ProductAdminOut(ProductOut):
    cost_price: Decimal


class ProductStats(ApiModel):
    sold_last_30_days: int
    last_movement_at: datetime | None


class ProductDetailOut(ProductOut):
    stats: ProductStats


class ProductAdminDetailOut(ProductAdminOut):
    stats: ProductStats


class _ProductFields(RequestModel):
    name: str = Field(min_length=2, max_length=200)
    category_id: int
    sale_price: Decimal = Money
    cost_price: Decimal = Money
    min_stock: int = Field(0, ge=0)
    description: str | None = Field(None, max_length=2000)
    image_url: str | None = Field(None, max_length=500)
    is_active: bool = True

    @field_validator("image_url")
    @classmethod
    def http_url(cls, value: str | None) -> str | None:
        if not value:
            return None
        if not value.startswith(("http://", "https://")):
            raise ValueError("Görsel adresi http:// ya da https:// ile başlamalıdır.")
        return value

    @field_validator("description")
    @classmethod
    def empty_to_none(cls, value: str | None) -> str | None:
        return value or None


def _normalize_sku(value: str) -> str:
    value = value.upper()
    if not SKU_PATTERN.match(value):
        raise ValueError("SKU yalnızca büyük harf, rakam ve tire içerebilir (2-64 karakter).")
    return value


class ProductCreateRequest(_ProductFields):
    # Boş bırakılırsa kategoriye göre otomatik üretilir.
    sku: str | None = Field(None, max_length=64)
    initial_stock: int = Field(0, ge=0)

    @field_validator("sku")
    @classmethod
    def valid_sku(cls, value: str | None) -> str | None:
        return _normalize_sku(value) if value else None


class ProductUpdateRequest(_ProductFields):
    sku: str = Field(max_length=64)

    @field_validator("sku")
    @classmethod
    def valid_sku(cls, value: str) -> str:
        return _normalize_sku(value)


class ProductSort(StrEnum):
    SKU = "sku"
    NAME = "name"
    SALE_PRICE = "sale_price"
    COST_PRICE = "cost_price"
    STOCK = "stock"
    CREATED_AT = "created_at"


class SkuSuggestion(ApiModel):
    sku: str


# --- Stok hareketleri (ürün detayı) ---


class UserRef(ApiModel):
    id: int
    full_name: str


class OrderRef(ApiModel):
    id: int
    order_code: str


class MovementOut(ApiModel):
    id: int
    movement_type: StockMovementType
    quantity: int
    previous_stock: int
    new_stock: int
    description: str | None
    created_at: datetime
    user: UserRef
    order: OrderRef | None
