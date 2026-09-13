from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, extract
from app.models.erp import Product, Category, Sale
from app.models.user import User

class DashboardRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_total_stock(self) -> int:
        return self.db.query(func.coalesce(func.sum(Product.stock), 0)).scalar()

    def get_total_revenue(self) -> float:
        return self.db.query(func.coalesce(func.sum(Sale.total_amount), 0.0)).scalar()

    def get_active_users_count(self) -> int:
        return self.db.query(func.count(User.id)).filter(User.is_active == True).scalar()

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
        return (
            self.db.query(
                extract('month', Sale.created_at).label("month_num"),
                func.sum(Sale.total_amount).label("ciro")
            )
            .group_by("month_num")
            .order_by("month_num")
            .all()
        )

    def get_all_categories(self):
        return self.db.query(Category).all()

    def get_all_products(self):
        return self.db.query(Product).all()