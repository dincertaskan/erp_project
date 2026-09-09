from pydantic import BaseModel
from typing import List

class MonthlySale(BaseModel):
    month: str
    ciro: float

class CategoryDistribution(BaseModel):
    name: str
    value: int
    color: str

class CriticalStockItem(BaseModel):
    id: int
    name: str
    category: str
    stock: int
    min_stock: int

class RecentActivityItem(BaseModel):
    id: int
    text: str
    amount: str
    date: str

class DashboardDataResponse(BaseModel):
    total_stock: int
    monthly_sales_total: float
    active_customers: int
    critical_stock_count: int
    sales_data: List[MonthlySale]
    category_data: List[CategoryDistribution]
    critical_stock: List[CriticalStockItem]
    recent_activities: List[RecentActivityItem]

class ProductCreate(BaseModel):
    name: str
    category_id: int
    stock: int
    min_stock: int
    price: float

class SaleCreate(BaseModel):
    product_id: int
    quantity: int