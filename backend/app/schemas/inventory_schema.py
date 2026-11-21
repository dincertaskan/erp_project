from datetime import datetime

from pydantic import BaseModel, model_validator


# STOK HAREKET VE DÜZENLEME ŞEMALARI
class StockAdjustmentCreate(BaseModel):
    user_name: str
    action_type: str  # "ARTTIR" veya "AZALT"
    quantity: int
    description: str | None = None

class StockMovementResponse(BaseModel):
    id: int
    user_name: str
    action_type: str
    quantity: int
    previous_stock: int | None = None
    new_stock: int | None = None
    description: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True

class ProductCreate(BaseModel):
    name: str
    category_id: int
    unit_price: float
    cost_price: float | None = 0.0
    stock: int | None = 0
    min_stock: int | None = 5
    image_url: str | None = None
    description: str | None = None

    @model_validator(mode='after')
    def validate_prices(self):
        if self.unit_price < self.cost_price:
            raise ValueError("Satış fiyatı maliyet fiyatından düşük olamaz.")
        return self

class ProductUpdate(BaseModel):
    name: str | None = None
    category_id: int | None = None
    unit_price: float | None = None
    cost_price: float | None = None
    image_url: str | None = None
    description: str | None = None

    @model_validator(mode='after')
    def validate_prices(self):
        if self.unit_price is not None and self.cost_price is not None:
            if self.unit_price < self.cost_price:
                raise ValueError("Satış fiyatı maliyet fiyatından düşük olamaz.")
        return self

class ProductDetailResponse(BaseModel):
    id: int
    name: str
    category_id: int
    category_name: str | None = None
    unit_price: float
    cost_price: float
    stock: int
    min_stock: int
    image_url: str | None = None
    is_critical: bool | None = False
    description: str | None = None

    class Config:
        from_attributes = True