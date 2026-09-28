from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean, Text, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from datetime import datetime

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    color = Column(String, default="#6366f1")

    products = relationship("Product", back_populates="category")


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    company_name = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    sales = relationship("Sale", back_populates="customer")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    stock = Column(Integer, default=0)
    min_stock = Column(Integer, default=5)
    unit_price = Column(Float, default=0.0)
    cost_price = Column(Float, default=0.0)
    image_url = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    category = relationship("Category", back_populates="products")
    sales = relationship("Sale", back_populates="product")
    movements = relationship("StockMovement", back_populates="product", cascade="all, delete-orphan")


class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    total_amount = Column(Float, nullable=False)
    status = Column(String, default="Tamamlandı")
    note = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("Product", back_populates="sales")
    customer = relationship("Customer", back_populates="sales")


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    user_name = Column(String, nullable=False)
    action_type = Column(String, nullable=False)  # "ARTTIR" veya "AZALT"
    quantity = Column(Integer, nullable=False)
    previous_stock = Column(Integer, nullable=True)
    new_stock = Column(Integer, nullable=True)
    description = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("Product", back_populates="movements")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True) # Düzeltildi
    order_code = Column(String(50), unique=True, nullable=False, index=True)
    customer_name = Column(String(100), nullable=False, default="Misafir Müşteri")
    total_price = Column(Numeric(10, 2), nullable=False)
    payment_method = Column(String(50), default="Kredi Kartı")
    payment_status = Column(String(30), default="Ödendi")
    order_status = Column(String(30), default="Onay Bekliyor")  # "Onay Bekliyor", "Hazırlanıyor", "Kargolandı", "Tamamlandı", "İptal"
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.now)

    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    total_price = Column(Numeric(10, 2), nullable=False)

    order = relationship("Order", back_populates="items")
    product = relationship("Product")