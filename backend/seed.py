from app.core.database import SessionLocal, engine, Base
from app.models.erp import Category, Product, Sale

Base.metadata.create_all(bind=engine)
db = SessionLocal()

if db.query(Category).count() == 0:
    c1 = Category(name="Elektronik", color="#6366f1")
    c2 = Category(name="Ofis Malzemeleri", color="#ec4899")
    c3 = Category(name="Yedek Parça", color="#10b981")
    db.add_all([c1, c2, c3])
    db.commit()

    p1 = Product(name="Logitech MX Master 3S", category_id=c1.id, stock=2, min_stock=5, price=3500.0)
    p2 = Product(name="Ergonomik Ofis Koltuğu", category_id=c2.id, stock=15, min_stock=3, price=4500.0)
    p3 = Product(name="USB-C Hub Multiport", category_id=c3.id, stock=1, min_stock=10, price=750.0)
    db.add_all([p1, p2, p3])
    db.commit()

    s1 = Sale(product_id=p1.id, quantity=1, total_amount=3500.0)
    s2 = Sale(product_id=p2.id, quantity=2, total_amount=9000.0)
    s3 = Sale(product_id=p3.id, quantity=5, total_amount=3750.0)
    db.add_all([s1, s2, s3])
    db.commit()

    print("PostgreSQL veritabanına test verileri başarıyla eklendi!")

db.close()