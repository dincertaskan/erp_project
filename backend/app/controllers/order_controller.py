from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.schemas.order_schema import OrderCreate
from app.repositories.order_repository import OrderRepository

router = APIRouter(prefix="/orders", tags=["Orders"])

# Durum Güncelleme İsteği İçin Pydantic Şeması
class OrderStatusUpdate(BaseModel):
    order_status: str

@router.get("")
def get_orders(db: Session = Depends(get_db)):
    """Tüm sipariş listesini getirir."""
    repo = OrderRepository(db)
    return repo.get_all_orders()

@router.post("", status_code=status.HTTP_201_CREATED)
def create_order(data: OrderCreate, db: Session = Depends(get_db)):
    """Yeni bir sipariş oluşturur ve stok miktarını düşer."""
    repo = OrderRepository(db)
    try:
        return repo.create_order(data, user_name="Dinçer Taşkan")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Sipariş oluşturulurken bir hata meydana geldi.")

# GÜNCELLENDİ: Hem PUT hem PATCH isteklerini ve hem Body hem Query Parametresini destekler
@router.patch("/{order_id}/status")
@router.put("/{order_id}/status")
def update_order_status(
    order_id: int, 
    data: Optional[OrderStatusUpdate] = None, 
    status: Optional[str] = Query(None), 
    db: Session = Depends(get_db)
):
    """
    Sipariş durumunu günceller ("Onay Bekliyor", "Hazırlanıyor", "Kargolandı", "Tamamlandı", "İptal").
    'İptal' durumunda stoku iade eder ve ödemeyi 'İade Edildi' yapar.
    'İptal' veya 'Tamamlandı' olan siparişlerin tekrar değiştirilmesini engeller.
    """
    repo = OrderRepository(db)
    
    # Hem JSON Body (order_status) hem Query Param (status) kontrol edilir
    new_status = None
    if data and data.order_status:
        new_status = data.order_status
    elif status:
        new_status = status

    if not new_status:
        raise HTTPException(status_code=400, detail="Geçerli bir sipariş durumu belirtilmelidir.")

    try:
        return repo.update_order_status(order_id, new_status, user_name="Dinçer Taşkan")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Sipariş durumu güncellenirken bir hata oluştu.")