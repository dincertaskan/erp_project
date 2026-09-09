from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.dashboard_schema import DashboardDataResponse, ProductCreate, SaleCreate
from app.repositories.dashboard_repository import DashboardRepository
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

def get_dashboard_service(db: Session = Depends(get_db)) -> DashboardService:
    repo = DashboardRepository(db)
    return DashboardService(repo)

@router.get("/stats", response_model=DashboardDataResponse)
def get_stats(service: DashboardService = Depends(get_dashboard_service)):
    return service.get_dashboard_summary()

@router.get("/categories")
def get_categories(service: DashboardService = Depends(get_dashboard_service)):
    return service.repo.get_all_categories()

@router.get("/products")
def get_products(service: DashboardService = Depends(get_dashboard_service)):
    return service.repo.get_all_products()

# Yeni Ürün Ekle
@router.post("/products")
def create_product(data: ProductCreate, service: DashboardService = Depends(get_dashboard_service)):
    return service.repo.create_product(data)

# Yeni Sipariş/Satış Oluştur
@router.post("/sales")
def create_sale(data: SaleCreate, service: DashboardService = Depends(get_dashboard_service)):
    product = service.repo.get_product_by_id(data.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı.")
    if product.stock < data.quantity:
        raise HTTPException(status_code=400, detail=f"Yetersiz stok! Mevcut stok: {product.stock}")
    
    return service.repo.create_sale(product, data.quantity)