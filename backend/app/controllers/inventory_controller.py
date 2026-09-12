from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.models.erp import Product, StockMovement
from app.schemas.inventory_schema import StockAdjustmentCreate, StockMovementResponse

router = APIRouter(prefix="/inventory", tags=["Inventory"])

# 1. Ürün Listesi (Durum Filtrelemeli)
@router.get("/products")
def get_products(
    search: Optional[str] = Query(None),
    category_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None), # <-- DURUM FİLTRESİ EKLENDİ
    db: Session = Depends(get_db)
):
    query = db.query(Product)
    if category_id:
        query = query.filter(Product.category_id == category_id)
    if search:
        query = query.filter(Product.name.ilike(f"%{search}%"))
        
    # Duruma Göre Filtreleme
    if status_filter == "critical":
        query = query.filter(Product.stock <= Product.min_stock)
    elif status_filter == "normal":
        query = query.filter(Product.stock > Product.min_stock)
        
    products = query.order_by(Product.id.desc()).all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "category_name": p.category.name if p.category else "Genel",
            "stock": p.stock,
            "min_stock": p.min_stock,
            "price": p.price,
            "is_critical": p.stock <= p.min_stock
        }
        for p in products
    ]

# 2. Stok Düzenleme ve Log Kaydetme
@router.post("/products/{product_id}/adjust-stock")
def adjust_stock(
    product_id: int, 
    data: StockAdjustmentCreate, 
    db: Session = Depends(get_db)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı.")

    if data.action_type == "ARTTIR":
        product.stock += data.quantity
    elif data.action_type == "AZALT":
        if product.stock < data.quantity:
            raise HTTPException(status_code=400, detail="Mevcut stoktan daha fazla azaltma yapılamaz!")
        product.stock -= data.quantity
    else:
        raise HTTPException(status_code=400, detail="Geçersiz işlem tipi.")

    movement = StockMovement(
        product_id=product.id,
        user_name=data.user_name,
        action_type=data.action_type,
        quantity=data.quantity,
        description=data.description
    )
    db.add(movement)
    db.commit()
    db.refresh(product)
    
    return {"message": "Stok başarıyla güncellendi.", "new_stock": product.stock}

# 3. Ürünün Hareket Loglarını Getirme
@router.get("/products/{product_id}/logs")
def get_product_logs(product_id: int, db: Session = Depends(get_db)):
    movements = db.query(StockMovement).filter(
        StockMovement.product_id == product_id
    ).order_by(StockMovement.created_at.desc()).all()
    
    return [
        {
            "id": m.id,
            "user_name": m.user_name,
            "action_type": m.action_type,
            "quantity": m.quantity,
            "description": m.description or "Açıklama belirtilmedi.",
            "created_at": m.created_at.strftime("%Y-%m-%d %H:%M:%S") if m.created_at else ""
        }
        for m in movements
    ]

# 4. Ürün Silme
@router.delete("/products/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı.")
    db.delete(product)
    db.commit()
    return {"message": "Ürün başarıyla silindi."}