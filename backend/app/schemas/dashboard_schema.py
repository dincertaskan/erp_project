
from pydantic import BaseModel


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
    image_url: str | None = None

class DashboardDataResponse(BaseModel):
    total_stock: int
    monthly_revenue: float
    active_customers: int
    critical_stock_count: int
    sales_data: list[SalesDataPoint] = []
    category_data: list[CategoryDataPoint] = []
    critical_stock: list[CriticalStockItem] = []
    recent_activities: list[dict] = []

    class Config:
        from_attributes = True