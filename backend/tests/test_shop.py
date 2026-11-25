import pytest
from sqlalchemy import select

from app.models import Order, OrderStatus, StockMovement
from tests.conftest import auth_headers


def line(product, quantity=1, price=None):
    return {"product_id": product.id, "quantity": quantity, "expected_price": price or str(product.sale_price)}


def place(client, user, items, **extra):
    payload = {
        "items": items,
        "payment_method": "credit_card",
        "shipping_address": "Bağdat Cad. No: 5, İstanbul",
        **extra,
    }
    return client.post("/me/orders", headers=auth_headers(user), json=payload)


# --- Katalog ---


def test_catalog_hides_inactive_products_categories_and_cost(client, customer, make_category, make_product):
    visible = make_product(sku="CAT-OK", stock=50)
    make_product(sku="CAT-PASSIVE", is_active=False)
    make_product(make_category(is_active=False), sku="CAT-HIDDEN-CATEGORY")

    body = client.get("/catalog/products", headers=auth_headers(customer)).json()

    assert [p["sku"] for p in body["items"]] == ["CAT-OK"]
    item = body["items"][0]
    assert "cost_price" not in item and "stock" not in item
    assert (item["availability"], item["available_qty"]) == ("in_stock", 50)
    assert body["items"][0]["id"] == visible.id


def test_availability_labels(client, customer, make_product):
    make_product(sku="AV-LOW", stock=3)
    make_product(sku="AV-OUT", stock=0)

    items = client.get("/catalog/products", headers=auth_headers(customer)).json()["items"]

    assert {p["sku"]: p["availability"] for p in items} == {"AV-LOW": "low_stock", "AV-OUT": "out_of_stock"}


def test_catalog_filters_sorting_and_price_bounds(client, customer, make_category, make_product):
    office = make_category("Ofis")
    make_product(office, sku="F-1", sale_price="10.00", stock=5)
    make_product(office, sku="F-2", sale_price="50.00", stock=0)
    make_product(sku="F-3", sale_price="30.00", stock=5)

    def skus(**params):
        response = client.get("/catalog/products", headers=auth_headers(customer), params=params)
        return [p["sku"] for p in response.json()["items"]]

    assert skus(category_id=office.id, sort="price_desc") == ["F-2", "F-1"]
    assert skus(in_stock=True, sort="price_asc") == ["F-1", "F-3"]
    assert skus(min_price="20", max_price="40") == ["F-3"]
    bounds = client.get("/catalog/products", headers=auth_headers(customer), params={"min_price": 20}).json()
    assert (bounds["min_price"], bounds["max_price"]) == ("10.00", "50.00")


def test_catalog_categories_count_visible_products(client, customer, make_category, make_product):
    office = make_category("Ofis")
    make_product(office)
    make_product(office, is_active=False)
    make_category("Boş Kategori")

    body = client.get("/catalog/categories", headers=auth_headers(customer)).json()

    assert [(c["name"], c["product_count"]) for c in body] == [("Ofis", 1)]


def test_product_detail_with_related_and_unavailable_product(client, customer, make_category, make_product):
    category = make_category()
    product = make_product(category, stock=5)
    sibling = make_product(category, stock=5)
    passive = make_product(category, is_active=False)

    detail = client.get(f"/catalog/products/{product.id}", headers=auth_headers(customer)).json()
    missing = client.get(f"/catalog/products/{passive.id}", headers=auth_headers(customer))

    assert [p["id"] for p in detail["related"]] == [sibling.id]
    assert missing.status_code == 404
    assert missing.json()["message"] == "Bu ürün artık satışta değil."


def test_staff_do_not_use_the_shop(client, admin):
    assert client.get("/catalog/products", headers=auth_headers(admin)).status_code == 403


# --- Sepet doğrulama ve sipariş ---


def test_cart_validation_reports_each_problem(client, customer, make_product):
    ok = make_product(stock=10, sale_price="100.00")
    repriced = make_product(stock=10, sale_price="120.00")
    short = make_product(stock=2)
    gone = make_product(is_active=False)

    body = client.post(
        "/me/cart/validate",
        headers=auth_headers(customer),
        json={"items": [line(ok), line(repriced, price="100.00"), line(short, 5), line(gone)]},
    ).json()

    issues = {i["product_id"]: i for i in body["issues"]}
    assert ok.id not in issues
    assert issues[repriced.id]["issue"] == "price_changed"
    assert (issues[repriced.id]["old_price"], issues[repriced.id]["new_price"]) == ("100.00", "120.00")
    assert issues[short.id] | {"issue": "insufficient_stock", "available_qty": 2} == issues[short.id]
    assert issues[gone.id]["issue"] == "not_available"


def test_place_order_uses_server_prices_and_does_not_touch_stock(client, db, customer, make_product):
    product = make_product(stock=10, sale_price="45.50")

    response = place(client, customer, [line(product, 2)], note="Zil bozuk")

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "pending"
    assert body["total_amount"] == "91.00"
    assert body["can_cancel"] is True
    assert body["timeline"][0]["status"] == "pending"
    assert "changed_by" not in body["timeline"][0]
    order = db.get(Order, body["id"])
    assert order.created_by_id is None
    assert order.history[0].changed_by_id == customer.id
    db.refresh(product)
    assert product.stock == 10


def test_order_total_beyond_the_numeric_column_is_rejected(client, db, customer, make_product):
    first = make_product(sale_price="2000000.00", stock=10_000)
    second = make_product(sale_price="2000000.00", stock=10_000)

    response = place(client, customer, [line(first, 3000), line(second, 3000)])

    assert response.status_code == 422
    assert response.json()["details"] == [
        {"field": "items", "message": "Sipariş toplamı izin verilen üst sınırı aşıyor."}
    ]
    assert db.scalar(select(Order).where(Order.customer_id == customer.customer.id)) is None


def test_changed_cart_blocks_the_order(client, db, customer, make_product):
    product = make_product(sale_price="120.00")

    response = place(client, customer, [line(product, price="100.00")])

    assert response.status_code == 409
    body = response.json()
    assert body["code"] == "CART_CHANGED"
    assert body["details"][0]["issue"] == "price_changed"
    assert db.scalar(select(Order).where(Order.customer_id == customer.customer.id)) is None


@pytest.mark.parametrize("address", ["", "kısa"])
def test_shipping_address_is_required(client, customer, make_product, address):
    product = make_product()

    assert place(client, customer, [line(product)], shipping_address=address).status_code == 422


def test_inactive_customer_cannot_order(client, customer, make_product):
    customer.customer.is_active = False
    product = make_product()

    assert place(client, customer, [line(product)]).status_code == 403


# --- Siparişlerim ---


def test_my_orders_only_shows_my_own(client, make_user, customer, make_product):
    product = make_product(stock=100)
    mine = place(client, customer, [line(product)]).json()
    other = make_user()
    theirs = place(client, other, [line(product)]).json()

    listed = client.get("/me/orders", headers=auth_headers(customer)).json()
    foreign = client.get(f"/me/orders/{theirs['id']}", headers=auth_headers(customer))

    assert [o["id"] for o in listed["items"]] == [mine["id"]]
    assert listed["items"][0]["preview"][0]["sku"] == product.sku
    assert foreign.status_code == 404


def test_status_groups(client, admin, customer, make_product):
    product = make_product(stock=100)
    pending = place(client, customer, [line(product)]).json()
    approved = place(client, customer, [line(product)]).json()
    client.post(f"/orders/{approved['id']}/approve", headers=auth_headers(admin))
    cancelled = place(client, customer, [line(product)]).json()
    client.post(f"/me/orders/{cancelled['id']}/cancel", headers=auth_headers(customer))

    def ids(group):
        response = client.get("/me/orders", headers=auth_headers(customer), params={"status_group": group})
        return {o["id"] for o in response.json()["items"]}

    assert ids("active") == {pending["id"], approved["id"]}
    assert ids("cancelled") == {cancelled["id"]}
    assert ids("completed") == set()


def test_customer_cancels_pending_order_but_not_approved_one(client, db, admin, customer, make_product):
    product = make_product(stock=100)
    pending = place(client, customer, [line(product)]).json()
    approved = place(client, customer, [line(product)]).json()
    client.post(f"/orders/{approved['id']}/approve", headers=auth_headers(admin))

    cancelled = client.post(f"/me/orders/{pending['id']}/cancel", headers=auth_headers(customer))
    refused = client.post(f"/me/orders/{approved['id']}/cancel", headers=auth_headers(customer))

    assert cancelled.json()["status"] == "cancelled"
    assert cancelled.json()["can_cancel"] is False
    assert refused.status_code == 409
    assert refused.json()["message"] == "Siparişiniz onaylandığı için artık iptal edilemiyor."
    assert db.get(Order, approved["id"]).status == OrderStatus.PREPARING
    assert db.scalar(select(StockMovement).where(StockMovement.order_id == pending["id"])) is None
