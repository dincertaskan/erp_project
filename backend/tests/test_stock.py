import threading
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import delete, select

from app.core.database import SessionLocal
from app.core.errors import ConflictError
from app.core.security import hash_password
from app.models import Category, Product, StockMovement, StockMovementType, User, UserRole
from app.repositories.catalog_repository import STOCK_STATUS_FILTERS
from app.schemas.catalog import stock_status
from app.schemas.stock import StockMovementRequest
from app.services.stock_service import StockService
from tests.conftest import auth_headers


def move(client, user, product, movement_type, quantity, description="Test işlemi"):
    return client.post(
        "/stock/movements",
        headers=auth_headers(user),
        json={
            "product_id": product.id,
            "movement_type": movement_type,
            "quantity": quantity,
            "description": description,
        },
    )


# --- Giriş / çıkış ---


def test_warehouse_records_stock_in(client, db, warehouse, make_product):
    product = make_product(stock=3, min_stock=10)

    response = move(client, warehouse, product, "in", 50, "İrsaliye 1024")

    assert response.status_code == 201
    body = response.json()
    assert body["product"] == {"id": product.id, "stock": 53, "stock_status": "sufficient"}
    movement = body["movement"]
    assert (movement["previous_stock"], movement["new_stock"], movement["quantity"]) == (3, 53, 50)
    assert movement["user"]["id"] == warehouse.id
    db.refresh(product)
    assert (product.stock, product.version) == (53, 2)


def test_stock_out_reports_critical_status(client, admin, make_product):
    product = make_product(stock=12, min_stock=10)

    response = move(client, admin, product, "out", 5, "Sayım farkı")

    assert response.json()["product"] == {"id": product.id, "stock": 7, "stock_status": "critical"}


def test_stock_out_cannot_go_below_zero(client, db, warehouse, make_product):
    product = make_product(stock=3)

    response = move(client, warehouse, product, "out", 4, "Fire")

    assert response.status_code == 409
    body = response.json()
    assert body["code"] == "INSUFFICIENT_STOCK"
    assert body["message"] == "Yetersiz stok. Mevcut: 3."
    assert body["details"] == [
        {"product_id": product.id, "sku": product.sku, "name": product.name, "requested": 4, "available": 3}
    ]
    db.refresh(product)
    assert product.stock == 3
    assert db.scalar(select(StockMovement).where(StockMovement.product_id == product.id)) is None


def test_stock_out_requires_a_reason(client, warehouse, make_product):
    product = make_product()

    response = move(client, warehouse, product, "out", 1, "  ")

    assert response.status_code == 422
    assert "açıklama zorunludur" in response.json()["details"][0]["message"]


def test_stock_in_reason_is_optional(client, warehouse, make_product):
    product = make_product()

    response = move(client, warehouse, product, "in", 1, None)

    assert response.status_code == 201
    assert response.json()["movement"]["description"] is None


@pytest.mark.parametrize("quantity", [0, -3])
def test_quantity_must_be_positive(client, warehouse, make_product, quantity):
    product = make_product()

    assert move(client, warehouse, product, "in", quantity).status_code == 422


def test_order_movement_types_cannot_be_entered_by_hand(client, warehouse, make_product):
    product = make_product()

    assert move(client, warehouse, product, "order_out", 1).status_code == 422


def test_inactive_products_are_rejected(client, warehouse, make_product):
    product = make_product(is_active=False)

    response = move(client, warehouse, product, "in", 1)

    assert response.status_code == 400
    assert response.json()["code"] == "PRODUCT_INACTIVE"


def test_unknown_product_is_404(client, warehouse):
    response = client.post(
        "/stock/movements",
        headers=auth_headers(warehouse),
        json={"product_id": 999999, "movement_type": "in", "quantity": 1},
    )

    assert response.status_code == 404


def test_customers_cannot_move_stock(client, customer, make_product):
    product = make_product()

    assert move(client, customer, product, "in", 1).status_code == 403


# --- Hareket listesi ---


def add_movement(db, product, user, movement_type, quantity, *, hours_ago=0, order_id=None):
    movement = StockMovement(
        product_id=product.id,
        user_id=user.id,
        order_id=order_id,
        movement_type=movement_type,
        quantity=quantity,
        previous_stock=10,
        new_stock=10,
        created_at=datetime.now(UTC) - timedelta(hours=hours_ago),
    )
    db.add(movement)
    db.flush()
    return movement


def test_movement_list_filters(client, db, admin, warehouse, make_product):
    first, second = make_product(), make_product()
    add_movement(db, first, admin, StockMovementType.IN, 5, hours_ago=48)
    add_movement(db, first, warehouse, StockMovementType.OUT, 2, hours_ago=1)
    add_movement(db, second, warehouse, StockMovementType.ORDER_OUT, 1, hours_ago=2)

    def query(**params):
        response = client.get("/stock/movements", headers=auth_headers(admin), params=params)
        assert response.status_code == 200
        return response.json()

    assert query()["total"] == 3
    assert query(product_id=first.id)["total"] == 2
    assert query(user_id=warehouse.id)["total"] == 2
    assert query(type=["out", "order_out"])["total"] == 2
    recent = query(**{"from": (datetime.now(UTC) - timedelta(hours=24)).isoformat()})
    assert recent["total"] == 2
    newest = recent["items"][0]
    assert newest["movement_type"] == "out"
    assert newest["product"]["sku"] == first.sku


# --- Kritik stok ---


def test_critical_list_puts_the_most_critical_first(client, db, warehouse, make_product):
    make_product(sku="K-HALF", stock=5, min_stock=10)
    make_product(sku="K-LOW", stock=1, min_stock=4)
    make_product(sku="K-OK", stock=10, min_stock=10)
    make_product(sku="K-EMPTY", stock=0, min_stock=4)
    make_product(sku="K-ZERO-MIN", stock=0, min_stock=0)
    make_product(sku="K-PASSIVE", stock=1, min_stock=5, is_active=False)

    body = client.get("/stock/critical", headers=auth_headers(warehouse)).json()

    # Stoğu 0 olan ürün kritik değil, tükenmiştir; kritik listede yer almaz.
    assert [(p["sku"], p["shortage"]) for p in body["items"]] == [("K-LOW", 3), ("K-HALF", 5)]
    assert {p["stock_status"] for p in body["items"]} == {"critical"}
    count = client.get("/stock/critical/count", headers=auth_headers(warehouse)).json()
    assert count == {"count": 2}


# (stok, minimum) sınır durumları: tükendi, kritik ve yeterli arasındaki tüm geçişler.
STOCK_CASES = [(0, 0), (0, 5), (1, 5), (4, 5), (5, 5), (6, 5), (3, 0)]


def test_stock_status_label_matches_repository_definitions(db, make_product):
    # Ekrandaki etiket (stock_status) ile sorgulardaki tanımlar (stock_repository) aynı kuralı uygular.
    products = [make_product(stock=stock, min_stock=min_stock) for stock, min_stock in STOCK_CASES]
    ids = [p.id for p in products]

    for status, condition in STOCK_STATUS_FILTERS.items():
        matched = set(db.scalars(select(Product.id).where(Product.id.in_(ids), condition)))
        expected = {p.id for p in products if stock_status(p.stock, p.min_stock) == status}
        assert matched == expected, status


def test_critical_count_is_the_same_on_every_screen(client, admin, make_product):
    make_product(stock=1, min_stock=5)
    make_product(stock=4, min_stock=5)
    make_product(stock=0, min_stock=5)
    make_product(stock=5, min_stock=5)
    make_product(stock=2, min_stock=5, is_active=False)
    headers = auth_headers(admin)

    counts = {
        "dashboard": client.get("/dashboard/summary", headers=headers).json()["critical_stock_count"],
        "rozet": client.get("/stock/critical/count", headers=headers).json()["count"],
        "kritik stok sayfası": client.get("/stock/critical", headers=headers).json()["total"],
        "stok özeti": client.get("/stock/summary", headers=headers).json()["critical_count"],
        "ürün filtresi": client.get(
            "/products", headers=headers, params={"stock_status": "critical", "is_active": "true"}
        ).json()["total"],
    }

    assert counts == dict.fromkeys(counts, 2)


def test_summary_counts(client, db, warehouse, make_product):
    product = make_product(stock=1, min_stock=5)
    make_product(stock=50, min_stock=5)
    add_movement(db, product, warehouse, StockMovementType.IN, 1)

    body = client.get("/stock/summary", headers=auth_headers(warehouse)).json()

    assert body == {"active_products": 2, "critical_count": 1, "today_movements": 1}


def test_product_list_shows_last_movement(client, db, warehouse, make_product):
    product = make_product()
    add_movement(db, product, warehouse, StockMovementType.IN, 1)

    item = client.get("/products", headers=auth_headers(warehouse)).json()["items"][0]

    assert item["last_movement_at"] is not None


# --- Eşzamanlılık: gerçek commit'lerle, ayrı oturumlarda ---


@pytest.fixture
def committed_product():
    """Kilit davranışını görmek için veriler test işleminin dışında, gerçekten commit edilir."""
    with SessionLocal() as session:
        user = User(
            full_name="Eşzamanlı Depo",
            email="concurrency@example.com",
            password_hash=hash_password("Test1234"),
            role=UserRole.WAREHOUSE,
        )
        category = Category(name="Eşzamanlılık Testi")
        product = Product(
            sku="CONC-0001", name="Yarış Ürünü", category=category, stock=5, min_stock=0, sale_price=Decimal("1")
        )
        session.add_all([user, category, product])
        session.commit()
        ids = (user.id, product.id, category.id)
    yield ids
    with SessionLocal() as session:
        session.execute(delete(StockMovement).where(StockMovement.product_id == ids[1]))
        session.execute(delete(Product).where(Product.id == ids[1]))
        session.execute(delete(Category).where(Category.id == ids[2]))
        session.execute(delete(User).where(User.id == ids[0]))
        session.commit()


def test_concurrent_stock_outs_never_oversell(committed_product):
    user_id, product_id, _ = committed_product
    barrier = threading.Barrier(2)
    results: list[str] = []

    def take_three():
        with SessionLocal() as session:
            actor = session.get(User, user_id)
            barrier.wait()
            try:
                StockService(session).record(
                    actor,
                    StockMovementRequest(product_id=product_id, movement_type="out", quantity=3, description="Yarış"),
                )
                results.append("ok")
            except ConflictError:
                results.append("conflict")

    threads = [threading.Thread(target=take_three) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=10)

    assert sorted(results) == ["conflict", "ok"]
    with SessionLocal() as session:
        assert session.get(Product, product_id).stock == 2
        movements = session.scalars(select(StockMovement).where(StockMovement.product_id == product_id)).all()
        assert [(m.previous_stock, m.new_stock) for m in movements] == [(5, 2)]


def _read_then_write_twice(product_id: int, user_id: int):
    """İki oturum aynı stoğu okur, sonra sırayla 3'er adet düşer (araya giren yazma)."""
    from app.services.stock_ledger import apply_movement, commit_stock_changes, lock_products

    first, second = SessionLocal(), SessionLocal()
    try:
        product_a = lock_products(first, [product_id])[product_id]
        product_b = lock_products(second, [product_id])[product_id]
        apply_movement(first, product_a, movement_type=StockMovementType.OUT, quantity=3, user_id=user_id)
        commit_stock_changes(first)
        apply_movement(second, product_b, movement_type=StockMovementType.OUT, quantity=3, user_id=user_id)
        commit_stock_changes(second)
        return "ok"
    except ConflictError as exc:
        return exc.code
    finally:
        first.close()
        second.close()


def test_none_strategy_loses_an_update(committed_product, monkeypatch):
    """Deney 1 referansı: kilitsiz modda iki çıkış da kabul edilir ama stok yalnızca bir kez düşer."""
    from app.core.config import settings

    user_id, product_id, _ = committed_product
    monkeypatch.setattr(settings, "STOCK_STRATEGY", "none")

    assert _read_then_write_twice(product_id, user_id) == "ok"
    with SessionLocal() as session:
        assert session.get(Product, product_id).stock == 2  # 6 adet satıldı, stok yalnızca 3 düştü
        assert len(session.scalars(select(StockMovement).where(StockMovement.product_id == product_id)).all()) == 2


def test_optimistic_strategy_rejects_the_stale_write(committed_product, monkeypatch):
    from app.core.config import settings

    user_id, product_id, _ = committed_product
    monkeypatch.setattr(settings, "STOCK_STRATEGY", "optimistic")

    assert _read_then_write_twice(product_id, user_id) == "STOCK_CONFLICT"
    with SessionLocal() as session:
        assert session.get(Product, product_id).stock == 2
