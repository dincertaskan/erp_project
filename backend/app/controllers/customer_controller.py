from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.repositories.customer_repository import CustomerRepository

router = APIRouter(prefix="/customers", tags=["Customers"])

@router.get("")
def get_customers(db: Session = Depends(get_db)):
    """Sistemdeki tüm müşterileri ve sipariş özetlerini getirir."""
    repo = CustomerRepository(db)
    return repo.get_all_customers()