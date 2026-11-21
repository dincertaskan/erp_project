from datetime import datetime
from enum import StrEnum

from pydantic import Field, model_validator

from app.models import StockMovementType
from app.schemas.catalog import MovementOut, ProductOut, StockStatus
from app.schemas.common import ApiModel, RequestModel


class ManualMovementType(StrEnum):
    IN = "in"
    OUT = "out"


class StockMovementRequest(RequestModel):
    product_id: int
    movement_type: ManualMovementType
    quantity: int = Field(gt=0, le=1_000_000)
    description: str | None = Field(None, max_length=500)

    @model_validator(mode="after")
    def description_for_outgoing(self):
        # Elle yapılan çıkışlarda gerekçe zorunludur (denetim izi); girişte isteğe bağlıdır.
        text = (self.description or "").strip()
        if self.movement_type == ManualMovementType.OUT and len(text) < 3:
            raise ValueError("Çıkış işlemlerinde açıklama zorunludur (en az 3 karakter).")
        self.description = text or None
        return self


class ProductRef(ApiModel):
    id: int
    sku: str
    name: str


class ProductStock(ApiModel):
    id: int
    stock: int
    stock_status: StockStatus


class StockMovementResult(ApiModel):
    movement: MovementOut
    product: ProductStock


class MovementListItem(MovementOut):
    product: ProductRef


class CriticalProductOut(ProductOut):
    shortage: int
    sold_last_30_days: int


class CriticalCount(ApiModel):
    count: int


class StockSummary(ApiModel):
    active_products: int
    critical_count: int
    today_movements: int


class MovementFilters(ApiModel):
    date_from: datetime | None = None
    date_to: datetime | None = None
    product_id: int | None = None
    types: list[StockMovementType] = []
    user_id: int | None = None
    order_code: str | None = None
