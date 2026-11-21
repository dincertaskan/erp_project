"""Demo verisi: roller için örnek hesaplar, kategoriler ve ürünler.

Tekrar çalıştırılabilir; var olan kayıtlar atlanır. Hesap şifresi SEED_PASSWORD
ortam değişkeninden okunur (bkz. README, "Demo hesaplar").

    python -m app.seed
"""

import os
import sys
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import Category, Customer, Product, StockMovement, StockMovementType, User, UserRole

USERS = [
    {"full_name": "Elif Yılmaz", "email": "yonetici@demo.local", "role": UserRole.ADMIN},
    {"full_name": "Ayşe Kaya", "email": "depo@demo.local", "role": UserRole.WAREHOUSE},
    {"full_name": "Can Demir", "email": "musteri@demo.local", "role": UserRole.CUSTOMER},
]

CUSTOMER_PROFILE = {
    "musteri@demo.local": {"phone": "0532 000 00 00", "address": "Örnek Mah. Demo Sok. No: 1", "city": "İstanbul"},
}

CATEGORIES = [
    {"name": "Elektronik", "color": "#6366F1"},
    {"name": "Ofis Malzemeleri", "color": "#EC4899"},
    {"name": "Yedek Parça", "color": "#10B981"},
]

PRODUCTS = [
    ("ELK-0001", "Kablosuz Mouse", "Elektronik", "449.90", "260.00", 3, 10),
    ("ELK-0002", "Logitech MX Master 3S", "Elektronik", "3500.00", "2450.00", 2, 5),
    ("ELK-0003", "Mekanik Klavye", "Elektronik", "1899.00", "1150.00", 25, 5),
    ("ELK-0004", "27 inç Monitör", "Elektronik", "7499.00", "5600.00", 8, 3),
    ("OFS-0001", "Ergonomik Ofis Koltuğu", "Ofis Malzemeleri", "4500.00", "3100.00", 15, 3),
    ("OFS-0002", "A4 Fotokopi Kağıdı (500 yaprak)", "Ofis Malzemeleri", "189.90", "120.00", 120, 30),
    ("YDK-0001", "USB-C Hub Multiport", "Yedek Parça", "750.00", "420.00", 1, 10),
    ("YDK-0002", "Laptop Şarj Adaptörü 65W", "Yedek Parça", "899.00", "540.00", 0, 5),
]


def seed(db: Session, password: str) -> None:
    users = {}
    for data in USERS:
        user = db.scalar(select(User).where(User.email == data["email"]))
        if user is None:
            user = User(**data, password_hash=hash_password(password))
            db.add(user)
            db.flush()
        users[data["email"]] = user

    for email, profile in CUSTOMER_PROFILE.items():
        user = users[email]
        if db.scalar(select(Customer).where(Customer.user_id == user.id)) is None:
            db.add(Customer(user_id=user.id, full_name=user.full_name, email=user.email, **profile))

    categories = {}
    for data in CATEGORIES:
        category = db.scalar(select(Category).where(Category.name == data["name"]))
        if category is None:
            category = Category(**data)
            db.add(category)
            db.flush()
        categories[data["name"]] = category

    admin = users["yonetici@demo.local"]
    for sku, name, category_name, sale_price, cost_price, stock, min_stock in PRODUCTS:
        if db.scalar(select(Product).where(Product.sku == sku)) is not None:
            continue
        product = Product(
            sku=sku,
            name=name,
            category=categories[category_name],
            sale_price=Decimal(sale_price),
            cost_price=Decimal(cost_price),
            stock=stock,
            min_stock=min_stock,
        )
        db.add(product)
        db.flush()
        if stock > 0:
            db.add(
                StockMovement(
                    product_id=product.id,
                    user_id=admin.id,
                    movement_type=StockMovementType.IN,
                    quantity=stock,
                    previous_stock=0,
                    new_stock=stock,
                    description="Başlangıç stoku",
                )
            )

    db.commit()


def main() -> None:
    password = os.getenv("SEED_PASSWORD")
    if not password:
        sys.exit("SEED_PASSWORD tanımlı değil. README'deki 'Demo hesaplar' bölümüne bakın.")
    with SessionLocal() as db:
        seed(db, password)
    print("Demo verisi yüklendi.")


if __name__ == "__main__":
    main()
