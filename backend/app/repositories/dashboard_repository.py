from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, extract
from app.models.erp import Product, Category, Order
from app.models.user import User
from datetime import datetime

class DashboardRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_total_stock(self) -> int:
        return self.db.query(func.coalesce(func.sum(Product.stock), 0)).scalar()

    def get_total_revenue(self) -> float:
        # İptal edilmemiş ve ödenmiş siparişlerin toplam cirosu
        total = self.db.query(func.coalesce(func.sum(Order.total_price), 0))\
            .filter(
                Order.payment_status == "Ödendi",
                Order.order_status != "İptal"
            )\
            .scalar()
        return float(total) if total else 0.0

    def get_active_users_count(self) -> int:
        return self.db.query(func.count(User.id)).filter(
            User.is_active == True,
            User.role == "customer"
        ).scalar()

    def get_critical_products(self):
        return (
            self.db.query(Product)
            .options(joinedload(Product.category))
            .filter(Product.stock <= Product.min_stock, Product.is_active == True)
            .all()
        )

    def get_category_distribution(self):
        return (
            self.db.query(
                Category.name, 
                Category.color, 
                func.coalesce(func.sum(Product.stock), 0).label("value")
            )
            .outerjoin(Product, Category.id == Product.category_id)
            .group_by(Category.id, Category.name, Category.color)
            .all()
        )

    def get_sales_by_month(self):
        current_year = datetime.now().year
        month_expr = extract('month', Order.created_at)
        
        # Sadece iptal edilmemiş siparişlerin aylara göre cirosu hesaplanır
        sales_data = (
            self.db.query(
                month_expr.label("month_num"),
                func.coalesce(func.sum(Order.total_price), 0).label("ciro")
            )
            .filter(
                extract('year', Order.created_at) == current_year,
                Order.order_status != "İptal"  # İPTAL EDİLEN SİPARİŞLER GRAFİKTEN ÇIKARILDI
            )
            .group_by(month_expr)
            .order_by(month_expr)
            .all()
        )
        return sales_data

    def get_all_categories(self):
        return self.db.query(Category).all()

    def get_all_products(self):
        return self.db.query(Product).all()