from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.models import Order, OrderStatus, PaymentMethod, StockMovement, StockMovementType
from tests.conftest import auth_headers


def product_payload(category_id: int, **overrides) -> dict:
    payload = {
        "name": "Kablosuz Klavye",
        "category_id": category_id,
        "sale_price": "899.90",
        "cost_price": "550.00",
        "min_stock": 5,
    }
    payload.update(overrides)
    return payload


# --- Listeleme ---


def test_admin_sees_cost_but_warehouse_does_not(client, admin, warehouse, make_product):
    make_product()

    admin_item = client.get("/products", headers=auth_headers(admin)).json()["items"][0]
    staff_item = client.get("/products", headers=auth_headers(warehouse)).json()["items"][0]

    assert admin_item["cost_price"] == "60.00"
    assert "cost_price" not in staff_item
    assert staff_item["sale_price"] == "100.00"


def test_customers_cannot_use_the_panel_product_list(client, customer):
    assert client.get("/products", headers=auth_headers(customer)).status_code == 403


def test_search_matches_name_or_sku(client, admin, make_product):
    make_product(sku="ELK-0001", name="Kablosuz Mouse")
    make_product(sku="OFS-0001", name="Ofis Koltuğu")

    by_name = client.get("/products", headers=auth_headers(admin), params={"search": "mouse"}).json()
    by_sku = client.get("/products", headers=auth_headers(admin), params={"search": "ofs-"}).json()

    assert [p["sku"] for p in by_name["items"]] == ["ELK-0001"]
    assert [p["sku"] for p in by_sku["items"]] == ["OFS-0001"]


def test_stock_status_filter_and_label(client, admin, make_product):
    make_product(sku="A-1", stock=20, min_stock=5)
    make_product(sku="A-2", stock=3, min_stock=5)
    make_product(sku="A-3", stock=0, min_stock=5)

    def skus(status):
        response = client.get("/products", headers=auth_headers(admin), params={"stock_status": status})
        return {(p["sku"], p["stock_status"]) for p in response.json()["items"]}

    assert skus("sufficient") == {("A-1", "sufficient")}
    assert skus("critical") == {("A-2", "critical")}
    assert skus("out_of_stock") == {("A-3", "out_of_stock")}


def test_filters_by_category_and_status(client, admin, make_category, make_product):
    first, second, third = make_category(), make_category(), make_category()
    make_product(first, sku="C-1")
    make_product(second, sku="C-2")
    make_product(third, sku="C-3")
    make_product(first, sku="C-4", is_active=False)

    response = client.get(
        "/products",
        headers=auth_headers(admin),
        params={"category_id": [first.id, second.id], "is_active": True},
    )

    assert {p["sku"] for p in response.json()["items"]} == {"C-1", "C-2"}


def test_sorting_and_pagination(client, admin, make_product):
    for sku, price in [("S-1", "30.00"), ("S-2", "10.00"), ("S-3", "20.00")]:
        make_product(sku=sku, sale_price=price)

    response = client.get(
        "/products", headers=auth_headers(admin), params={"sort": "-sale_price", "page": 1, "page_size": 2}
    )

    body = response.json()
    assert body["total"] == 3
    assert [p["sku"] for p in body["items"]] == ["S-1", "S-3"]


def test_warehouse_cannot_sort_by_cost(client, warehouse):
    response = client.get("/products", headers=auth_headers(warehouse), params={"sort": "cost_price"})

    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_SORT"


def test_unknown_sort_field_is_rejected(client, admin):
    response = client.get("/products", headers=auth_headers(admin), params={"sort": "password_hash"})

    assert response.status_code == 422


# --- Ekleme ---


def test_create_with_generated_sku_and_initial_stock_movement(client, db, admin, make_category, make_product):
    category = make_category("Elektronik")
    make_product(category, sku="ELK-0004")

    response = client.post(
        "/products", headers=auth_headers(admin), json=product_payload(category.id, initial_stock=12)
    )

    assert response.status_code == 201
    body = response.json()
    assert body["sku"] == "ELK-0005"
    assert body["stock"] == 12
    assert body["category"]["name"] == "Elektronik"
    movement = db.scalar(select(StockMovement).where(StockMovement.product_id == body["id"]))
    assert movement.movement_type == StockMovementType.IN
    assert (movement.quantity, movement.previous_stock, movement.new_stock) == (12, 0, 12)
    assert movement.user_id == admin.id


def test_create_without_stock_records_no_movement(client, db, admin, make_category):
    category = make_category()

    body = client.post("/products", headers=auth_headers(admin), json=product_payload(category.id)).json()

    assert body["stock"] == 0
    assert db.scalar(select(StockMovement).where(StockMovement.product_id == body["id"])) is None


def test_sale_price_below_cost_is_allowed(client, admin, make_category):
    category = make_category()

    response = client.post(
        "/products",
        headers=auth_headers(admin),
        json=product_payload(category.id, sale_price="10.00", cost_price="20.00"),
    )

    assert response.status_code == 201


def test_manual_sku_is_uppercased_and_must_be_unique(client, admin, make_category, make_product):
    category = make_category()
    make_product(sku="ABC-1")

    created = client.post("/products", headers=auth_headers(admin), json=product_payload(category.id, sku="xyz-9"))
    taken = client.post("/products", headers=auth_headers(admin), json=product_payload(category.id, sku="abc-1"))

    assert created.json()["sku"] == "XYZ-9"
    assert taken.status_code == 409
    assert taken.json()["details"] == [{"field": "sku", "message": "Bu SKU kullanılıyor."}]


@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"name": "A"}, "name"),
        ({"sale_price": "-1"}, "sale_price"),
        ({"cost_price": "1.999"}, "cost_price"),
        ({"min_stock": -1}, "min_stock"),
        ({"initial_stock": -5}, "initial_stock"),
        ({"sku": "boşluk var"}, "sku"),
        ({"image_url": "javascript:alert(1)"}, "image_url"),
    ],
)
def test_create_validation(client, admin, make_category, overrides, field):
    category = make_category()

    response = client.post("/products", headers=auth_headers(admin), json=product_payload(category.id, **overrides))

    assert response.status_code == 422
    assert field in {d["field"] for d in response.json()["details"]}


def test_cannot_add_product_to_inactive_category(client, admin, make_category):
    category = make_category(is_active=False)

    response = client.post("/products", headers=auth_headers(admin), json=product_payload(category.id))

    assert response.status_code == 400
    assert response.json()["code"] == "CATEGORY_INACTIVE"


def test_warehouse_cannot_create_products(client, warehouse, make_category):
    category = make_category()

    response = client.post("/products", headers=auth_headers(warehouse), json=product_payload(category.id))

    assert response.status_code == 403


def test_next_sku_suggestion(client, admin, make_category, make_product):
    category = make_category("Yedek Parça")
    make_product(category, sku="YDK-0002")

    response = client.get("/products/next-sku", headers=auth_headers(admin), params={"category_id": category.id})

    assert response.json() == {"sku": "YDK-0003"}


# --- Düzenleme ve durum ---


def test_update_does_not_change_stock(client, admin, make_product):
    product = make_product(stock=7)

    response = client.put(
        f"/products/{product.id}",
        headers=auth_headers(admin),
        json=product_payload(product.category_id, sku=product.sku, name="Yeni Ad", min_stock=9),
    )

    assert response.status_code == 200
    body = response.json()
    assert (body["name"], body["stock"], body["min_stock"]) == ("Yeni Ad", 7, 9)
    assert body["stock_status"] == "critical"


def test_update_rejects_stock_field(client, admin, make_product):
    product = make_product()

    response = client.put(
        f"/products/{product.id}",
        headers=auth_headers(admin),
        json=product_payload(product.category_id, sku=product.sku, stock=999),
    )

    assert response.status_code == 422


def test_product_in_a_deactivated_category_can_still_be_edited(client, admin, make_category, make_product):
    category = make_category()
    product = make_product(category)
    category.is_active = False

    response = client.put(
        f"/products/{product.id}",
        headers=auth_headers(admin),
        json=product_payload(category.id, sku=product.sku),
    )

    assert response.status_code == 200


def test_deactivate_and_reactivate(client, admin, make_product):
    product = make_product()

    off = client.patch(f"/products/{product.id}/status", headers=auth_headers(admin), json={"is_active": False})
    on = client.patch(f"/products/{product.id}/status", headers=auth_headers(admin), json={"is_active": True})

    assert off.json()["is_active"] is False
    assert on.json()["is_active"] is True


def test_there_is_no_delete_endpoint(client, admin, make_product):
    product = make_product()

    response = client.delete(f"/products/{product.id}", headers=auth_headers(admin))

    assert response.status_code == 405


# --- Detay ve stok geçmişi ---


def test_detail_includes_recent_sales(client, db, admin, warehouse, make_product):
    product = make_product(stock=10)
    now = datetime.now(UTC)
    for quantity, movement_type, created_at in [
        (4, StockMovementType.ORDER_OUT, now - timedelta(days=2)),
        (3, StockMovementType.ORDER_OUT, now - timedelta(days=45)),
        (5, StockMovementType.IN, now - timedelta(days=1)),
    ]:
        db.add(
            StockMovement(
                product_id=product.id,
                user_id=admin.id,
                movement_type=movement_type,
                quantity=quantity,
                previous_stock=10,
                new_stock=10,
                created_at=created_at,
            )
        )
    db.flush()

    admin_body = client.get(f"/products/{product.id}", headers=auth_headers(admin)).json()
    staff_body = client.get(f"/products/{product.id}", headers=auth_headers(warehouse)).json()

    assert admin_body["stats"]["sold_last_30_days"] == 4
    assert admin_body["stats"]["last_movement_at"] is not None
    assert admin_body["cost_price"] == "60.00"
    assert "cost_price" not in staff_body


def test_detail_of_missing_product_is_404(client, admin):
    assert client.get("/products/999999", headers=auth_headers(admin)).status_code == 404


def test_movements_are_paginated_and_show_user_and_order(client, db, admin, customer, make_product):
    product = make_product()
    order = Order(
        order_code="SIP-TEST-1",
        customer_id=customer.customer.id,
        status=OrderStatus.PREPARING,
        total_amount=100,
        payment_method=PaymentMethod.CREDIT_CARD,
        shipping_address="Adres",
        created_by_id=admin.id,
    )
    db.add(order)
    db.flush()
    db.add_all(
        [
            StockMovement(
                product_id=product.id,
                user_id=admin.id,
                movement_type=StockMovementType.IN,
                quantity=5,
                previous_stock=5,
                new_stock=10,
                created_at=datetime.now(UTC) - timedelta(hours=2),
            ),
            StockMovement(
                product_id=product.id,
                user_id=admin.id,
                order_id=order.id,
                movement_type=StockMovementType.ORDER_OUT,
                quantity=2,
                previous_stock=10,
                new_stock=8,
                created_at=datetime.now(UTC) - timedelta(hours=1),
            ),
        ]
    )
    db.flush()

    everything = client.get(f"/products/{product.id}/movements", headers=auth_headers(admin)).json()
    only_in = client.get(f"/products/{product.id}/movements", headers=auth_headers(admin), params={"type": "in"}).json()

    assert everything["total"] == 2
    latest = everything["items"][0]
    assert latest["movement_type"] == "order_out"
    assert latest["order"] == {"id": order.id, "order_code": "SIP-TEST-1"}
    assert latest["user"]["full_name"] == admin.full_name
    assert [m["movement_type"] for m in only_in["items"]] == ["in"]


def test_movement_date_filter_reads_naive_times_as_istanbul(client, db, admin, make_product):
    product = make_product()
    # İstanbul saatiyle 2 Mart 00:30 (UTC 1 Mart 21:30)
    db.add(
        StockMovement(
            product_id=product.id,
            user_id=admin.id,
            movement_type=StockMovementType.IN,
            quantity=1,
            previous_stock=10,
            new_stock=11,
            created_at=datetime(2026, 3, 1, 21, 30, tzinfo=UTC),
        )
    )
    db.flush()

    def count(**params):
        url = f"/products/{product.id}/movements"
        return client.get(url, headers=auth_headers(admin), params=params).json()["total"]

    assert count(**{"from": "2026-03-02T00:00:00"}) == 1
    assert count(**{"to": "2026-03-02T00:00:00"}) == 0
    assert count(**{"from": "2026-03-02T00:00:00Z"}) == 0
