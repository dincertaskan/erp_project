from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.schemas.inventory_schema import (
    StockAdjustmentCreate, 
    ProductCreate, 
    ProductUpdate, 
    ProductDetailResponse
)
from app.repositories.inventory_repository import InventoryRepository

router = APIRouter(prefix="/inventory", tags=["Inventory"])

# 1. Ürün Listesi (Filtrelemeli)
@router.get("/products", response_model=List[ProductDetailResponse])
def get_products(
    search: Optional[str] = Query(None),
    category_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    repo = InventoryRepository(db)
    return repo.get_all_products(search=search, category_id=category_id, status_filter=status_filter)

# 2. Tekil Ürün Detayı (YENİ EKLENDİ)
@router.get("/products/{product_id}", response_model=ProductDetailResponse)
def get_product_detail(product_id: int, db: Session = Depends(get_db)):
    repo = InventoryRepository(db)
    product = repo.get_product_by_id(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Aradığınız ürün bulunamadı.")
    return product

# 3. Yeni Ürün Ekle
@router.post("/products", response_model=ProductDetailResponse, status_code=status.HTTP_201_CREATED)
def create_product(product_data: ProductCreate, db: Session = Depends(get_db)):
    repo = InventoryRepository(db)
    return repo.create_product(product_data)

# 4. Ürün Güncelle
@router.put("/products/{product_id}", response_model=ProductDetailResponse)
def update_product(product_id: int, product_data: ProductUpdate, db: Session = Depends(get_db)):
    repo = InventoryRepository(db)
    product = repo.update_product(product_id, product_data)
    if not product:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı.")
    return product

# 5. Ürün Sil
@router.delete("/products/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    repo = InventoryRepository(db)
    success = repo.delete_product(product_id)
    if not success:
        raise HTTPException(status_code=404, detail="Silinecek ürün bulunamadı.")
    return {"message": "Ürün başarıyla silindi."}

# 6. Stok Düzenleme ve Log Kaydetme
@router.post("/products/{product_id}/adjust-stock")
def adjust_stock(
    product_id: int, 
    data: StockAdjustmentCreate, 
    db: Session = Depends(get_db)
):
    repo = InventoryRepository(db)
    product, error = repo.adjust_stock(product_id, data)
    if error:
        raise HTTPException(status_code=400 if "stok" in error or "işlem" in error else 404, detail=error)
    
    return {
        "message": "Stok başarıyla güncellendi.", 
        "new_stock": product.stock
    }

# 7. Ürünün Stok Hareket Loglarını Getirme
@router.get("/products/{product_id}/logs")
def get_product_logs(product_id: int, db: Session = Depends(get_db)):
    repo = InventoryRepository(db)
    movements = repo.get_product_logs(product_id)
    
    return [
        {
            "id": m.id,
            "user_name": m.user_name,
            "action_type": m.action_type,
            "quantity": m.quantity,
            "previous_stock": m.previous_stock,
            "new_stock": m.new_stock,
            "description": m.description or "Açıklama belirtilmedi.",
            "created_at": m.created_at.strftime("%Y-%m-%d %H:%M:%S") if m.created_at else ""
        }
        for m in movements
    ]