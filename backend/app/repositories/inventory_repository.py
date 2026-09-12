from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.erp import Product, Category

class InventoryRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_all_products(self, search: str = None, category_id: int = None):
        query = self.db.query(Product)
        
        if category_id:
            query = query.filter(Product.category_id == category_id)
            
        if search:
            search_filter = f"%{search}%"
            query = query.filter(Product.name.ilike(search_filter))
            
        return query.order_by(Product.id.desc()).all()

    def get_product_by_id(self, product_id: int):
        return self.db.query(Product).filter(Product.id == product_id).first()

    def update_stock(self, product_id: int, new_stock: int):
        product = self.get_product_by_id(product_id)
        if product:
            product.stock = new_stock
            self.db.commit()
            self.db.refresh(product)
        return product

    def delete_product(self, product_id: int):
        product = self.get_product_by_id(product_id)
        if product:
            self.db.delete(product)
            self.db.commit()
            return True
        return False