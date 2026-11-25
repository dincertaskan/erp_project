import threading
from decimal import Decimal

import pytest
from sqlalchemy import delete, select

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.errors import ConflictError
from app.core.security import hash_password
from app.models import (
    Category,
    Customer,
    Order,
    OrderItem,
    OrderStatus,
    OrderStatusHistory,
    Product,
    RecordSource,
    StockMovement,
    StockMovementType,
    User,
    UserRole,
)
from app.schemas.order import OrderAction
from app.services.order_service import OrderService
from tests.conftest import auth_headers


def create_order(client, admin, customer, items, **extra):
    payload = {
        "customer_id": customer.customer.id,
        "items": [{"product_id": p.id, "quantity": q} for p, q in items],
        "payment_method": "bank_transfer",
        **extra,
    }
    return client.post("/orders", headers=auth_headers(admin), json=payload)


def act(client, user, order_id, action):
    return client.post(f"/orders/{order_id}/{action}", headers=auth_headers(user))


@pytest.fixture
def pending_order(client, admin, customer, make_product):
    keyboard = make_product(sku="ORD-KB", stock=10, sale_price="899.90")
    mouse = make_product(sku="ORD-MS", stock=5, sale_price="349.90")
    body = create_order(client, admin, customer, [(keyboard, 2), (mouse, 3)]).json()
    return body, keyboard, mouse


# --- Oluşturma ---


def test_create_order_uses_server_prices_and_customer_address(client, db, admin, customer, make_product):
    customer.customer.address = "Bağdat Cad. No: 5"
    customer.customer.city = "İstanbul"
    product = make_product(stock=10, sale_price="120.50")

    response = create_order(client, admin, customer, [(product, 3)], note="Kapıda arayın")

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "pending"
    assert body["order_code"].startswith("SIP-")
    assert len(body["order_code"]) == len("SIP-2026-000001")
    assert body["total_amount"] == "361.50"
    assert body["items"][0]["unit_price"] == "120.50"
    assert body["shipping_address"] == "Bağdat Cad. No: 5, İstanbul"
    assert body["allowed_actions"] == ["approve", "cancel"]
    assert body["history"][0]["to_status"] == "pending"
    db.refresh(product)
    assert product.stock == 10  # stok onayda düşülür


def test_order_codes_are_sequential(client, admin, customer, make_product):
    product = make_product()

    first = create_order(client, admin, customer, [(product, 1)]).json()["order_code"]
    second = create_order(client, admin, customer, [(product, 1)]).json()["order_code"]

    assert int(second[-6:]) == int(first[-6:]) + 1


def test_client_prices_are_ignored(client, admin, customer, make_product):
    product = make_product(sale_price="100.00")

    response = client.post(
        "/orders",
        headers=auth_headers(admin),
        json={
            "customer_id": customer.customer.id,
            "items": [{"product_id": product.id, "quantity": 1, "unit_price": "1.00"}],
            "payment_method": "credit_card",
        },
    )

    assert response.status_code == 422


def test_order_is_created_even_if_stock_is_short_but_reports_it(client, admin, customer, make_product):
    product = make_product(stock=2)

    body = create_order(client, admin, customer, [(product, 5)]).json()

    assert body["status"] == "pending"
    assert body["shortages"] == [
        {"product_id": product.id, "sku": product.sku, "name": product.name, "requested": 5, "available": 2}
    ]


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"items": []}, "items"),
        ({"items": [{"product_id": 1, "quantity": 0}]}, "items.0.quantity"),
        ({"payment_method": "bitcoin"}, "payment_method"),
    ],
)
def test_create_validation(client, admin, customer, payload, field):
    body = {
        "customer_id": customer.customer.id,
        "items": [{"product_id": 1, "quantity": 1}],
        "payment_method": "credit_card",
        **payload,
    }

    response = client.post("/orders", headers=auth_headers(admin), json=body)

    assert response.status_code == 422
    assert field in {d["field"] for d in response.json()["details"]}


def test_amounts_beyond_the_numeric_column_are_rejected(client, db, admin, customer, make_product):
    expensive = make_product(sale_price="9999999.99")
    big = make_product(sale_price="6000000000.00")

    line = create_order(client, admin, customer, [(big, 1), (expensive, 1001)])
    total = create_order(client, admin, customer, [(big, 1), (expensive, 500)])

    assert line.status_code == 422
    assert line.json()["code"] == "VALIDATION_ERROR"
    assert line.json()["details"][0]["field"] == "items.1.quantity"
    assert total.status_code == 422
    assert total.json()["details"][0]["field"] == "items"
    assert db.scalar(select(Order).where(Order.customer_id == customer.customer.id)) is None


def test_page_number_is_bounded(client, admin):
    response = client.get("/orders", headers=auth_headers(admin), params={"page": 100_001})

    assert response.status_code == 422
    assert response.json()["details"][0]["field"] == "page"


def test_duplicate_products_are_rejected(client, admin, customer, make_product):
    product = make_product()

    response = create_order(client, admin, customer, [(product, 1), (product, 2)])

    assert response.status_code == 422


def test_inactive_products_cannot_be_ordered(client, admin, customer, make_product):
    product = make_product(is_active=False)

    response = create_order(client, admin, customer, [(product, 1)])

    assert response.status_code == 400
    assert response.json()["code"] == "PRODUCT_INACTIVE"


def test_inactive_customers_cannot_order(client, admin, customer, make_product):
    customer.customer.is_active = False
    product = make_product()

    response = create_order(client, admin, customer, [(product, 1)])

    assert response.json()["code"] == "CUSTOMER_INACTIVE"


def test_warehouse_cannot_create_orders(client, warehouse, customer, make_product):
    product = make_product()

    assert create_order(client, warehouse, customer, [(product, 1)]).status_code == 403


# --- Onay ---


def test_approve_deducts_all_items_in_one_go(client, db, admin, pending_order):
    order, keyboard, mouse = pending_order

    response = act(client, admin, order["id"], "approve")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "preparing"
    assert body["approved_at"] is not None
    assert body["allowed_actions"] == ["ship", "cancel"]
    db.refresh(keyboard)
    db.refresh(mouse)
    assert (keyboard.stock, mouse.stock) == (8, 2)
    assert {(m["movement_type"], m["quantity"]) for m in body["movements"]} == {("order_out", 2), ("order_out", 3)}
    assert all(m["order"]["order_code"] == order["order_code"] for m in body["movements"])


def test_approve_with_shortage_changes_nothing_and_lists_every_missing_item(client, db, admin, customer, make_product):
    enough = make_product(sku="SH-OK", stock=10)
    short_a = make_product(sku="SH-A", stock=1)
    short_b = make_product(sku="SH-B", stock=0)
    order = create_order(client, admin, customer, [(enough, 2), (short_a, 3), (short_b, 1)]).json()

    response = act(client, admin, order["id"], "approve")

    assert response.status_code == 409
    body = response.json()
    assert body["code"] == "INSUFFICIENT_STOCK"
    assert body["message"] == "2 üründe stok yetersiz."
    assert {(d["sku"], d["requested"], d["available"]) for d in body["details"]} == {("SH-A", 3, 1), ("SH-B", 1, 0)}
    db.refresh(enough)
    assert enough.stock == 10
    assert db.get(Order, order["id"]).status == OrderStatus.PENDING
    assert db.scalar(select(StockMovement).where(StockMovement.order_id == order["id"])) is None


def test_approving_twice_is_rejected(client, admin, pending_order):
    order, *_ = pending_order
    act(client, admin, order["id"], "approve")

    response = act(client, admin, order["id"], "approve")

    assert response.status_code == 409
    assert response.json()["code"] == "INVALID_TRANSITION"


def test_warehouse_cannot_approve(client, warehouse, pending_order):
    order, *_ = pending_order

    assert act(client, warehouse, order["id"], "approve").status_code == 403


# --- Sonraki geçişler ---


def test_full_lifecycle_records_history(client, admin, warehouse, pending_order):
    order, *_ = pending_order
    act(client, admin, order["id"], "approve")

    shipped = act(client, warehouse, order["id"], "ship")
    completed = act(client, admin, order["id"], "complete")

    assert shipped.json()["status"] == "shipped"
    body = completed.json()
    assert body["status"] == "completed"
    assert body["allowed_actions"] == []
    assert [(h["from_status"], h["to_status"]) for h in body["history"]] == [
        (None, "pending"),
        ("pending", "preparing"),
        ("preparing", "shipped"),
        ("shipped", "completed"),
    ]
    assert body["history"][2]["changed_by"]["id"] == warehouse.id


def test_cancel_pending_order_does_not_touch_stock(client, db, admin, pending_order):
    order, keyboard, _ = pending_order

    response = act(client, admin, order["id"], "cancel")

    assert response.json()["status"] == "cancelled"
    assert response.json()["movements"] == []
    db.refresh(keyboard)
    assert keyboard.stock == 10


def test_cancel_preparing_order_returns_stock(client, db, admin, pending_order):
    order, keyboard, mouse = pending_order
    act(client, admin, order["id"], "approve")

    response = act(client, admin, order["id"], "cancel")

    body = response.json()
    assert body["status"] == "cancelled"
    assert body["cancelled_at"] is not None
    returns = [m for m in body["movements"] if m["movement_type"] == "cancel_return"]
    assert {(m["product"]["id"], m["quantity"]) for m in returns} == {(keyboard.id, 2), (mouse.id, 3)}
    db.refresh(keyboard)
    db.refresh(mouse)
    assert (keyboard.stock, mouse.stock) == (10, 5)


def test_shipped_orders_cannot_be_cancelled(client, admin, warehouse, pending_order):
    order, *_ = pending_order
    act(client, admin, order["id"], "approve")
    act(client, warehouse, order["id"], "ship")

    assert act(client, admin, order["id"], "cancel").status_code == 409


def test_olist_orders_are_read_only(client, db, admin, customer, make_product):
    order = Order(
        order_code="OLIST-1",
        customer_id=customer.customer.id,
        status=OrderStatus.PENDING,
        total_amount=Decimal("10"),
        payment_method="credit_card",
        source=RecordSource.OLIST,
    )
    db.add(order)
    db.flush()

    assert client.get(f"/orders/{order.id}", headers=auth_headers(admin)).json()["allowed_actions"] == []
    assert act(client, admin, order.id, "approve").status_code == 409


# --- Listeleme ---


def test_list_with_status_counts_and_search(client, admin, customer, make_product):
    product = make_product(stock=100)
    first = create_order(client, admin, customer, [(product, 1)]).json()
    create_order(client, admin, customer, [(product, 1)])
    act(client, admin, first["id"], "approve")

    everything = client.get("/orders", headers=auth_headers(admin)).json()
    preparing = client.get("/orders", headers=auth_headers(admin), params={"status": "preparing"}).json()
    by_code = client.get("/orders", headers=auth_headers(admin), params={"search": first["order_code"]}).json()

    assert everything["total"] == 2
    assert everything["counts_by_status"] == {"pending": 1, "preparing": 1}
    assert everything["items"][0]["item_count"] == 1
    assert preparing["total"] == 1
    assert preparing["counts_by_status"] == {"pending": 1, "preparing": 1}
    assert [o["id"] for o in by_code["items"]] == [first["id"]]


def test_warehouse_only_sees_preparing_and_shipped(client, admin, warehouse, customer, make_product):
    product = make_product(stock=100)
    approved = create_order(client, admin, customer, [(product, 1)]).json()
    pending = create_order(client, admin, customer, [(product, 1)]).json()
    act(client, admin, approved["id"], "approve")

    body = client.get("/orders", headers=auth_headers(warehouse)).json()

    assert [o["id"] for o in body["items"]] == [approved["id"]]
    assert body["counts_by_status"] == {"preparing": 1}
    assert body["items"][0]["allowed_actions"] == ["ship"]
    assert client.get(f"/orders/{pending['id']}", headers=auth_headers(warehouse)).status_code == 403


def test_warehouse_queue_excludes_olist_orders(client, db, admin, warehouse, customer, make_product):
    product = make_product(stock=100)
    approved = create_order(client, admin, customer, [(product, 1)]).json()
    act(client, admin, approved["id"], "approve")
    olist = Order(
        order_code="OLIST-PREP",
        customer_id=customer.customer.id,
        status=OrderStatus.PREPARING,
        total_amount=Decimal("10"),
        payment_method="credit_card",
        source=RecordSource.OLIST,
    )
    db.add(olist)
    db.flush()

    body = client.get("/orders", headers=auth_headers(warehouse)).json()
    admin_body = client.get("/orders", headers=auth_headers(admin)).json()

    assert [o["id"] for o in body["items"]] == [approved["id"]]
    assert (body["total"], body["counts_by_status"]) == (1, {"preparing": 1})
    assert client.get(f"/orders/{olist.id}", headers=auth_headers(warehouse)).status_code == 403
    # Yönetici listesi aktarılan siparişleri de gösterir; sayılar listeyle tutarlıdır.
    assert (admin_body["total"], admin_body["counts_by_status"]) == (2, {"preparing": 2})


def test_customers_cannot_use_panel_orders(client, customer):
    assert client.get("/orders", headers=auth_headers(customer)).status_code == 403


def test_customer_search_for_order_entry(client, admin, customer):
    customer.customer.company_name = "Demir Ticaret"

    body = client.get("/customers", headers=auth_headers(admin), params={"search": "demir tic"}).json()

    assert [c["id"] for c in body["items"]] == [customer.customer.id]


# --- Eşzamanlılık (Deney 1): iki stratejide de aynı stok iki kez satılmaz ---


@pytest.fixture
def committed_orders():
    """Aynı 5 adetlik ürün için 3'er adetlik iki sipariş; veriler gerçekten commit edilir."""
    with SessionLocal() as session:
        admin = User(
            full_name="Eşzamanlı Yönetici",
            email="order-race@example.com",
            password_hash=hash_password("Test1234"),
            role=UserRole.ADMIN,
        )
        customer = Customer(full_name="Yarış Müşterisi", email="order-race-customer@example.com")
        category = Category(name="Sipariş Yarışı")
        product = Product(sku="RACE-0001", name="Yarış", category=category, stock=5, sale_price=Decimal("10"))
        session.add_all([admin, customer, category, product])
        session.flush()
        orders = [
            Order(
                order_code=f"RACE-{n}",
                customer=customer,
                total_amount=Decimal("30"),
                payment_method="credit_card",
            )
            for n in (1, 2)
        ]
        for order in orders:
            order.items.append(
                OrderItem(product=product, quantity=3, unit_price=Decimal("10"), line_total=Decimal("30"))
            )
        session.add_all(orders)
        session.commit()
        ids = {"admin": admin.id, "product": product.id, "orders": [o.id for o in orders]}
        cleanup = {"customer": customer.id, "category": category.id}
    yield ids
    with SessionLocal() as session:
        session.execute(delete(StockMovement).where(StockMovement.product_id == ids["product"]))
        session.execute(delete(OrderStatusHistory).where(OrderStatusHistory.order_id.in_(ids["orders"])))
        session.execute(delete(Order).where(Order.id.in_(ids["orders"])))
        session.execute(delete(Product).where(Product.id == ids["product"]))
        session.execute(delete(Category).where(Category.id == cleanup["category"]))
        session.execute(delete(Customer).where(Customer.id == cleanup["customer"]))
        session.execute(delete(User).where(User.id == ids["admin"]))
        session.commit()


@pytest.mark.parametrize("strategy", ["pessimistic", "optimistic"])
def test_concurrent_approvals_never_oversell(committed_orders, monkeypatch, strategy):
    monkeypatch.setattr(settings, "STOCK_STRATEGY", strategy)
    barrier = threading.Barrier(2)
    results: list[str] = []

    def approve(order_id: int):
        with SessionLocal() as session:
            actor = session.get(User, committed_orders["admin"])
            barrier.wait()
            try:
                OrderService(session).transition(actor, order_id, OrderAction.APPROVE)
                results.append("ok")
            except ConflictError as exc:
                results.append(exc.code)

    threads = [threading.Thread(target=approve, args=(order_id,)) for order_id in committed_orders["orders"]]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=15)

    assert sorted(results) == ["INSUFFICIENT_STOCK", "ok"]
    with SessionLocal() as session:
        assert session.get(Product, committed_orders["product"]).stock == 2
        movements = session.scalars(
            select(StockMovement).where(StockMovement.product_id == committed_orders["product"])
        ).all()
        assert [(m.movement_type, m.previous_stock, m.new_stock) for m in movements] == [
            (StockMovementType.ORDER_OUT, 5, 2)
        ]
