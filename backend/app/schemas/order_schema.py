from datetime import datetime

from pydantic import BaseModel


class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int

class OrderCreate(BaseModel):
    customer_name: str | None = "Misafir Müşteri"
    payment_method: str | None = "Kredi Kartı"
    items: list[OrderItemCreate]
    note: str | None = None

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
    note: str | None
    created_at: datetime
    items: list[OrderItemResponse] = []

    class Config:
        from_attributes = True