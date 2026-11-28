"""Demo verisi: roller için örnek hesaplar, kategoriler, ürünler ve isteğe bağlı siparişler.

Tekrar çalıştırılabilir; var olan kayıtlar atlanır. Hesap şifresi SEED_PASSWORD
ortam değişkeninden okunur (bkz. README, "Demo hesaplar").

    python -m app.seed
    python -m app.seed --with-orders
"""

import argparse
import os
import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import Category, Customer, Product, StockMovement, StockMovementType, User, UserRole
from app.models.enums import OrderStatus, PaymentMethod, RecordSource
from app.models.order import Order, OrderItem, OrderStatusHistory

USERS = [
    {"full_name": "Elif Yılmaz", "email": "yonetici@example.com", "role": UserRole.ADMIN},
    {"full_name": "Ayşe Kaya", "email": "depo@example.com", "role": UserRole.WAREHOUSE},
    {"full_name": "Can Demir", "email": "musteri@example.com", "role": UserRole.CUSTOMER},
]

CUSTOMER_PROFILE = {
    "musteri@example.com": {"phone": "0532 000 00 00", "address": "Örnek Mah. Demo Sok. No: 1", "city": "İstanbul"},
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

# (order_code, days_ago, status, payment_method, [(sku, qty), ...], note)
SAMPLE_ORDERS = [
    ("SIP-DEMO-0001", 56, OrderStatus.COMPLETED, PaymentMethod.CREDIT_CARD, [("ELK-0003", 2), ("OFS-0002", 5)], "Ofis başlangıç siparişi"),
    ("SIP-DEMO-0002", 49, OrderStatus.COMPLETED, PaymentMethod.BANK_TRANSFER, [("ELK-0004", 1), ("OFS-0001", 1)], "Yönetici masası kurulumu"),
    ("SIP-DEMO-0003", 42, OrderStatus.COMPLETED, PaymentMethod.CREDIT_CARD, [("ELK-0001", 4), ("YDK-0001", 2)], "Ekip donanım yenileme"),
    ("SIP-DEMO-0004", 35, OrderStatus.CANCELLED, PaymentMethod.CASH_ON_DELIVERY, [("ELK-0002", 1)], "Müşteri talebiyle iptal edildi"),
    ("SIP-DEMO-0005", 28, OrderStatus.COMPLETED, PaymentMethod.BANK_TRANSFER, [("OFS-0001", 2), ("OFS-0002", 10)], "Aylık ofis tedariki"),
    ("SIP-DEMO-0006", 21, OrderStatus.COMPLETED, PaymentMethod.CREDIT_CARD, [("ELK-0004", 2), ("ELK-0003", 2)], "Yazılım ekibi monitör ve klavye"),
    ("SIP-DEMO-0007", 15, OrderStatus.COMPLETED, PaymentMethod.CREDIT_CARD, [("ELK-0002", 1), ("YDK-0001", 3)], "Hızlı teslimat"),
    ("SIP-DEMO-0008", 10, OrderStatus.SHIPPED, PaymentMethod.BANK_TRANSFER, [("OFS-0002", 8), ("ELK-0001", 2)], "Kargo şubesine teslim edildi"),
    ("SIP-DEMO-0009", 6, OrderStatus.SHIPPED, PaymentMethod.CREDIT_CARD, [("ELK-0003", 1), ("OFS-0001", 1)], "Yolda"),
    ("SIP-DEMO-0010", 3, OrderStatus.PREPARING, PaymentMethod.CREDIT_CARD, [("ELK-0004", 1), ("OFS-0002", 3)], "Depo paketleme aşamasında"),
    ("SIP-DEMO-0011", 2, OrderStatus.PREPARING, PaymentMethod.BANK_TRANSFER, [("ELK-0003", 2)], "Kargoya hazır"),
    ("SIP-DEMO-0012", 1, OrderStatus.PENDING, PaymentMethod.CREDIT_CARD, [("OFS-0002", 4), ("ELK-0001", 1)], "Onay bekleyen yeni sipariş"),
]


def cleanup_pilot_data(db: Session) -> None:
    """Deney pilotundan kalan test ürünlerini, kategorisini ve 10 TL'lik siparişleri temizler."""
    pilot_category = db.scalar(select(Category).where(Category.name == "Deney 1"))

    product_filters = [Product.name.ilike("%Deney ürünü%")]
    if pilot_category is not None:
        product_filters.append(Product.category_id == pilot_category.id)

    pilot_product_ids = list(db.scalars(select(Product.id).where(or_(*product_filters))))

    # Deney ürünlerini içeren siparişleri veya 10 TL / SIP-2026-0001xx deney siparişlerini bul
    pilot_order_ids: set[int] = set()
    if pilot_product_ids:
        pilot_order_ids.update(
            db.scalars(select(OrderItem.order_id).where(OrderItem.product_id.in_(pilot_product_ids)))
        )

    demo_customer = db.scalar(select(Customer).where(Customer.email == "musteri@example.com"))
    if demo_customer is not None:
        pilot_order_ids.update(
            db.scalars(
                select(Order.id).where(
                    Order.customer_id == demo_customer.id,
                    or_(
                        Order.total_amount == Decimal("10.00"),
                        Order.order_code.like("SIP-2026-0001%"),
                    ),
                )
            )
        )

    if pilot_order_ids:
        db.execute(delete(OrderStatusHistory).where(OrderStatusHistory.order_id.in_(pilot_order_ids)))
        db.execute(delete(OrderItem).where(OrderItem.order_id.in_(pilot_order_ids)))
        db.execute(delete(Order).where(Order.id.in_(pilot_order_ids)))

    if pilot_product_ids:
        db.execute(delete(StockMovement).where(StockMovement.product_id.in_(pilot_product_ids)))
        db.execute(delete(Product).where(Product.id.in_(pilot_product_ids)))

    if pilot_category is not None:
        db.delete(pilot_category)

    db.flush()


def seed_orders(db: Session, users: dict[str, User]) -> int:
    """Son 60 güne yayılmış, farklı durumlarda örnek siparişler üretir."""
    customer_user = users["musteri@example.com"]
    admin = users["yonetici@example.com"]
    warehouse = users["depo@example.com"]

    customer = db.scalar(select(Customer).where(Customer.user_id == customer_user.id))
    if customer is None:
        return 0

    products_by_sku = {p.sku: p for p in db.scalars(select(Product))}
    now = datetime.now(timezone.utc)
    created_count = 0

    for order_code, days_ago, status, payment_method, items_spec, note in SAMPLE_ORDERS:
        if db.scalar(select(Order).where(Order.order_code == order_code)) is not None:
            continue

        created_at = now - timedelta(days=days_ago)
        approved_at = created_at + timedelta(hours=3) if status in {OrderStatus.PREPARING, OrderStatus.SHIPPED, OrderStatus.COMPLETED} else None
        shipped_at = created_at + timedelta(days=1) if status in {OrderStatus.SHIPPED, OrderStatus.COMPLETED} else None
        completed_at = created_at + timedelta(days=3) if status == OrderStatus.COMPLETED else None
        cancelled_at = created_at + timedelta(hours=2) if status == OrderStatus.CANCELLED else None

        order_items = []
        total_amount = Decimal("0.00")
        for sku, qty in items_spec:
            product = products_by_sku.get(sku)
            if product is None:
                continue
            line_total = product.sale_price * qty
            total_amount += line_total
            order_items.append(
                OrderItem(
                    product_id=product.id,
                    quantity=qty,
                    unit_price=product.sale_price,
                    line_total=line_total,
                )
            )

        if not order_items:
            continue

        order = Order(
            order_code=order_code,
            customer_id=customer.id,
            status=status,
            total_amount=total_amount,
            payment_method=payment_method,
            shipping_address=f"{customer.address}, {customer.city}",
            note=note,
            created_by_id=customer_user.id,
            created_at=created_at,
            approved_at=approved_at,
            shipped_at=shipped_at,
            completed_at=completed_at,
            cancelled_at=cancelled_at,
            source=RecordSource.APP,
            items=order_items,
        )
        db.add(order)
        db.flush()

        # Durum geçmişi kayıtları
        history = [
            OrderStatusHistory(
                order_id=order.id,
                from_status=None,
                to_status=OrderStatus.PENDING,
                changed_by_id=customer_user.id,
                changed_at=created_at,
            )
        ]
        if approved_at:
            history.append(
                OrderStatusHistory(
                    order_id=order.id,
                    from_status=OrderStatus.PENDING,
                    to_status=OrderStatus.PREPARING,
                    changed_by_id=admin.id,
                    changed_at=approved_at,
                )
            )
        if shipped_at:
            history.append(
                OrderStatusHistory(
                    order_id=order.id,
                    from_status=OrderStatus.PREPARING,
                    to_status=OrderStatus.SHIPPED,
                    changed_by_id=warehouse.id,
                    changed_at=shipped_at,
                )
            )
        if completed_at:
            history.append(
                OrderStatusHistory(
                    order_id=order.id,
                    from_status=OrderStatus.SHIPPED,
                    to_status=OrderStatus.COMPLETED,
                    changed_by_id=warehouse.id,
                    changed_at=completed_at,
                )
            )
        if cancelled_at:
            history.append(
                OrderStatusHistory(
                    order_id=order.id,
                    from_status=OrderStatus.PENDING,
                    to_status=OrderStatus.CANCELLED,
                    changed_by_id=customer_user.id,
                    changed_at=cancelled_at,
                )
            )

        db.add_all(history)
        created_count += 1

    return created_count


def seed(db: Session, password: str, with_orders: bool = False) -> int:
    cleanup_pilot_data(db)

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
    db.flush()

    categories = {}
    for data in CATEGORIES:
        category = db.scalar(select(Category).where(Category.name == data["name"]))
        if category is None:
            category = Category(**data)
            db.add(category)
            db.flush()
        categories[data["name"]] = category

    admin = users["yonetici@example.com"]
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

    orders_created = seed_orders(db, users) if with_orders else 0
    db.commit()
    return orders_created


def main() -> None:
    parser = argparse.ArgumentParser(description="Akıllı ERP demo verisi yükleyici")
    parser.add_argument(
        "--with-orders",
        action="store_true",
        help="Son 60 güne yayılmış örnek siparişleri de oluşturur.",
    )
    args = parser.parse_args()

    password = os.getenv("SEED_PASSWORD")
    if not password:
        sys.exit("SEED_PASSWORD tanımlı değil. README'deki 'Demo hesaplar' bölümüne bakın.")
    with SessionLocal() as db:
        orders_created = seed(db, password, with_orders=args.with_orders)

    if args.with_orders:
        print(f"Demo verisi yüklendi ({orders_created} yeni örnek sipariş eklendi).")
    else:
        print("Demo verisi yüklendi.")


if __name__ == "__main__":
    main()