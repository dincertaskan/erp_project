from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.erp import Customer, Order

class CustomerRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_all_customers(self):
        # 'customers' tablosundaki tüm müşterileri getirir
        customers = self.db.query(Customer).order_by(Customer.id.desc()).all()

        result = []
        for c in customers:
            # Müşterinin toplam sipariş sayısı ve harcama tutarı
            order_stats = self.db.query(
                func.count(Order.id).label("order_count"),
                func.coalesce(func.sum(Order.total_price), 0).label("total_spent")
            ).filter(
                Order.customer_name == c.name,
                Order.order_status != "İptal"
            ).first()

            result.append({
                "id": c.id,
                "full_name": c.name,
                "email": c.email,
                "is_active": c.is_active if c.is_active is not None else True,
                "created_at": c.created_at,
                "avatar_url": c.avatar_url,
                "total_orders": order_stats.order_count if order_stats else 0,
                "total_spent": float(order_stats.total_spent) if order_stats else 0.0
            })
        return result
