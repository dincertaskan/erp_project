from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, extract
from app.models.erp import Product, Category, Order
from app.models.user import User

class DashboardRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_total_stock(self) -> int:
        return self.db.query(func.coalesce(func.sum(Product.stock), 0)).scalar()

    def get_total_revenue(self) -> float:
        total = self.db.query(func.sum(Order.total_price))\
            .filter(Order.payment_status == "Ödendi")\
            .scalar()
        return float(total) if total else 0.0

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
        month_expr = extract('month', Order.created_at)
        return (
            self.db.query(
                month_expr.label("month_num"),
                func.sum(Order.total_price).label("ciro")
            )
            .group_by(month_expr)
            .order_by(month_expr)
            .all()
        )

    def get_all_categories(self):
        return self.db.query(Category).all()

    def get_all_products(self):
        return self.db.query(Product).all()