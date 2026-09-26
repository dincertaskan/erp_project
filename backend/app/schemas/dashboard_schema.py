from pydantic import BaseModel
from typing import List, Optional

class SalesDataPoint(BaseModel):
    month: str
    ciro: float

class CategoryDataPoint(BaseModel):
    name: str
    value: int
    color: str

class CriticalStockItem(BaseModel):
    id: int
    name: str
    category: str
    stock: int
    min_stock: int
    image_url: Optional[str] = None

class DashboardDataResponse(BaseModel):
    total_stock: int
    monthly_revenue: float
    active_customers: int
    critical_stock_count: int
    sales_data: List[SalesDataPoint] = []
    category_data: List[CategoryDataPoint] = []
    critical_stock: List[CriticalStockItem] = []
    recent_activities: List[dict] = []

    class Config:
        from_attributes = True