from pydantic import BaseModel, model_validator
from typing import Optional
from datetime import datetime

# STOK HAREKET VE DÜZENLEME ŞEMALARI
class StockAdjustmentCreate(BaseModel):
    user_name: str
    action_type: str  # "ARTTIR" veya "AZALT"
    quantity: int
    description: Optional[str] = None

class StockMovementResponse(BaseModel):
    id: int
    user_name: str
    action_type: str
    quantity: int
    previous_stock: Optional[int] = None
    new_stock: Optional[int] = None
    description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ProductCreate(BaseModel):
    name: str
    category_id: int
    unit_price: float
    cost_price: Optional[float] = 0.0
    stock: Optional[int] = 0
    min_stock: Optional[int] = 5
    image_url: Optional[str] = None
    description: Optional[str] = None

    @model_validator(mode='after')
    def validate_prices(self):
        if self.unit_price < self.cost_price:
            raise ValueError("Satış fiyatı maliyet fiyatından düşük olamaz.")
        return self

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category_id: Optional[int] = None
    unit_price: Optional[float] = None
    cost_price: Optional[float] = None
    image_url: Optional[str] = None
    description: Optional[str] = None

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
    category_name: Optional[str] = None
    unit_price: float
    cost_price: float
    stock: int
    min_stock: int
    image_url: Optional[str] = None
    is_critical: Optional[bool] = False
    description: Optional[str] = None

    class Config:
        from_attributes = True