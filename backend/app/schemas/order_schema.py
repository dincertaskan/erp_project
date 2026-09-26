from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int

class OrderCreate(BaseModel):
    customer_name: Optional[str] = "Misafir Müşteri"
    payment_method: Optional[str] = "Kredi Kartı"
    items: List[OrderItemCreate]
    note: Optional[str] = None

class OrderItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    quantity: int
    unit_price: float
    total_price: float

    class Config:
        from_attributes = True

class OrderResponse(BaseModel):
    id: int
    order_code: str
    customer_name: str
    total_price: float
    payment_method: str
    payment_status: str
    order_status: str
    note: Optional[str]
    created_at: datetime
    items: List[OrderItemResponse] = []

    class Config:
        from_attributes = True