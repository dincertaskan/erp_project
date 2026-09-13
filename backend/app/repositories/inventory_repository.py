from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from app.models.erp import Product, Category, StockMovement

class InventoryRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_all_products(self, search: Optional[str] = None, category_id: Optional[int] = None, status_filter: Optional[str] = None) -> List[Product]:
        query = self.db.query(Product)
        
        if category_id:
            query = query.filter(Product.category_id == category_id)
            
        if search:
            query = query.filter(Product.name.ilike(f"%{search}%"))
            
        if status_filter == "critical":
            query = query.filter(Product.stock <= Product.min_stock)
        elif status_filter == "normal":
            query = query.filter(Product.stock > Product.min_stock)
            
        products = query.order_by(Product.id.desc()).all()
        for p in products:
            p.category_name = p.category.name if p.category else "Genel"
            p.is_critical = p.stock <= p.min_stock
        return products

    def get_product_by_id(self, product_id: int) -> Optional[Product]:
        product = (
            self.db.query(Product)
            .options(joinedload(Product.category))
            .filter(Product.id == product_id)
            .first()
        )
        if product:
            product.category_name = product.category.name if product.category else "Genel"
            product.is_critical = product.stock <= product.min_stock
        return product

    def create_product(self, product_data) -> Product:
        new_product = Product(
            name=product_data.name,
            category_id=product_data.category_id,
            unit_price=product_data.unit_price,
            cost_price=product_data.cost_price,
            stock=product_data.stock if product_data.stock is not None else 0,
            min_stock=product_data.min_stock if product_data.min_stock is not None else 5,
            image_url=product_data.image_url,
            description=getattr(product_data, 'description', None)
        )
        self.db.add(new_product)
        self.db.commit()
        self.db.refresh(new_product)
        
        category = self.db.query(Category).filter(Category.id == new_product.category_id).first()
        new_product.category_name = category.name if category else "Genel"
        new_product.is_critical = new_product.stock <= new_product.min_stock
        return new_product

    def update_product(self, product_id: int, product_data) -> Optional[Product]:
        product = self.get_product_by_id(product_id)
        if not product:
            return None
        
        update_dict = product_data.dict(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(product, key, value)
            
        self.db.commit()
        self.db.refresh(product)
        
        category = self.db.query(Category).filter(Category.id == product.category_id).first()
        product.category_name = category.name if category else "Genel"
        product.is_critical = product.stock <= product.min_stock
        return product

    def delete_product(self, product_id: int) -> bool:
        product = self.db.query(Product).filter(Product.id == product_id).first()
        if not product:
            return False
        self.db.delete(product)
        self.db.commit()
        return True

    def adjust_stock(self, product_id: int, data) -> tuple[Product, StockMovement]:
        product = self.get_product_by_id(product_id)
        if not product:
            return None, "Ürün bulunamadı."

        previous_stock = product.stock

        if data.action_type == "ARTTIR":
            product.stock += data.quantity
        elif data.action_type == "AZALT":
            if product.stock < data.quantity:
                return None, "Mevcut stoktan daha fazla azaltma yapılamaz!"
            product.stock -= data.quantity
        else:
            return None, "Geçersiz işlem tipi."

        new_stock = product.stock

        movement = StockMovement(
            product_id=product.id,
            user_name=data.user_name,
            action_type=data.action_type,
            quantity=data.quantity,
            previous_stock=previous_stock,
            new_stock=new_stock,
            description=data.description
        )
        
        self.db.add(movement)
        self.db.commit()
        self.db.refresh(product)
        return product, None

    def get_product_logs(self, product_id: int) -> List[StockMovement]:
        return self.db.query(StockMovement).filter(
            StockMovement.product_id == product_id
        ).order_by(StockMovement.created_at.desc()).all()