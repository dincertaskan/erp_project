import re
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest

from app.models import Customer, Order, OrderItem, OrderStatus, PaymentMethod, RecordSource
from tests.conftest import auth_headers


@pytest.fixture
def make_customer(db):
    counter = {"n": 0}

    def factory(name: str | None = None, **fields) -> Customer:
        counter["n"] += 1
        customer = Customer(
            full_name=name or f"Müşteri {counter['n']}",
            email=fields.pop("email", f"card{counter['n']}@example.com"),
            **fields,
        )
        db.add(customer)
        db.flush()
        return customer

    return factory


@pytest.fixture
def make_order(db, make_product):
    product = None

    def factory(customer: Customer, status: OrderStatus, total: str, *, days_ago: int = 0) -> Order:
        nonlocal product
        product = product or make_product()
        order = Order(
            order_code=f"T-{customer.id}-{status.value}-{total}-{days_ago}",
            customer_id=customer.id,
            status=status,
            total_amount=Decimal(total),
            payment_method=PaymentMethod.CREDIT_CARD,
            created_at=datetime.now(UTC) - timedelta(days=days_ago),
        )
        order.items.append(OrderItem(product=product, quantity=1, unit_price=Decimal(total), line_total=Decimal(total)))
        db.add(order)
        db.flush()
        return order

    return factory


def customer_payload(**overrides) -> dict:
    payload = {
        "full_name": "Deniz Ak",
        "email": "Deniz@Firma.com",
        "phone": "0532 111 22 33",
        "company_name": "Ak Ticaret",
        "address": "Atatürk Cad. 10",
        "city": "Ankara",
    }
    payload.update(overrides)
    return payload


# --- Liste ve istatistikler ---


def test_list_shows_order_stats_with_revenue_rule(client, admin, make_customer, make_order):
    buyer = make_customer("Alıcı")
    make_order(buyer, OrderStatus.COMPLETED, "100.00", days_ago=10)
    make_order(buyer, OrderStatus.PREPARING, "50.00", days_ago=2)
    make_order(buyer, OrderStatus.PENDING, "70.00", days_ago=1)
    make_order(buyer, OrderStatus.CANCELLED, "999.00", days_ago=0)
    make_customer("Siparişsiz")

    body = client.get("/customers", headers=auth_headers(admin), params={"sort": "-total_spent"}).json()

    first = body["items"][0]
    assert first["full_name"] == "Alıcı"
    assert first["order_count"] == 4
    assert first["total_spent"] == "150.00"  # bekleyen ve iptal edilen sayılmaz
    assert first["last_order_at"] is not None
    no_orders = next(c for c in body["items"] if c["full_name"] == "Siparişsiz")
    assert (no_orders["order_count"], no_orders["total_spent"], no_orders["last_order_at"]) == (0, "0", None)

    # Ada göre sıralamada istatistikler yalnızca sayfadaki müşteriler için toplanır; sonuç aynı olmalı.
    by_name = client.get("/customers", headers=auth_headers(admin), params={"sort": "full_name"}).json()
    stats = {c["full_name"]: (c["order_count"], c["total_spent"], c["last_order_at"]) for c in by_name["items"]}
    assert stats["Alıcı"] == (first["order_count"], first["total_spent"], first["last_order_at"])
    assert stats["Siparişsiz"] == (0, "0", None)


def test_list_filters(client, admin, customer, make_customer):
    make_customer("Ankara Müşterisi", city="Ankara", phone="0312 000 00 00")
    make_customer("Pasif Müşteri", is_active=False)

    def names(**params):
        response = client.get("/customers", headers=auth_headers(admin), params=params)
        return {c["full_name"] for c in response.json()["items"]}

    assert names(city="ankara") == {"Ankara Müşterisi"}
    assert names(search="0312") == {"Ankara Müşterisi"}
    assert names(is_active=False) == {"Pasif Müşteri"}
    assert names(has_account=True) == {customer.customer.full_name}


def test_search_treats_wildcards_as_text(client, admin, make_customer):
    make_customer("Yüzde %50 İndirim")
    make_customer("Alt_Çizgi Ltd")
    make_customer("Sıradan Müşteri")

    def names(search):
        response = client.get("/customers", headers=auth_headers(admin), params={"search": search})
        return {c["full_name"] for c in response.json()["items"]}

    assert names("%") == {"Yüzde %50 İndirim"}
    assert names("_") == {"Alt_Çizgi Ltd"}
    assert names("\\") == set()


def test_cities_for_filter(client, admin, make_customer):
    make_customer(city="İzmir")
    make_customer(city="Ankara")
    make_customer(city="Ankara")

    assert client.get("/customers/cities", headers=auth_headers(admin)).json() == ["Ankara", "İzmir"]


def test_only_admins_manage_customers(client, warehouse):
    assert client.get("/customers", headers=auth_headers(warehouse)).status_code == 403
    assert client.post("/customers", headers=auth_headers(warehouse), json=customer_payload()).status_code == 403


# --- Ekleme ve düzenleme ---


def test_admin_creates_customer_without_account(client, admin):
    response = client.post("/customers", headers=auth_headers(admin), json=customer_payload())

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "deniz@firma.com"
    assert body["has_account"] is False
    assert body["stats"] == {
        "order_count": 0,
        "revenue_order_count": 0,
        "total_spent": "0",
        "average_basket": "0",
        "last_order_at": None,
    }


# --- Davet koduyla karta bağlanma ---

REGISTER_DENIZ = {"full_name": "Deniz Ak", "email": "deniz@firma.com", "password": "Guclu1234"}
INVITE_CODE = re.compile(r"^[A-Z2-9]{5}-[A-Z2-9]{5}$")


def login(client, email: str) -> dict[str, str]:
    token = client.post("/auth/login", json={"email": email, "password": "Guclu1234"}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_registration_without_invite_code_does_not_expose_the_admin_created_card(client, db, admin, make_order):
    created = client.post("/customers", headers=auth_headers(admin), json=customer_payload()).json()
    make_order(db.get(Customer, created["id"]), OrderStatus.SHIPPED, "250.00")

    response = client.post("/auth/register", json=REGISTER_DENIZ)

    # Hesap açılmaz, kart bağlanmaz; kartın siparişlerini görecek bir oturum da oluşmaz.
    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "INVITE_CODE_REQUIRED"
    assert body["details"][0]["field"] == "invite_code"
    assert "davet kodu" in body["message"]
    assert client.get(f"/customers/{created['id']}", headers=auth_headers(admin)).json()["has_account"] is False
    login_attempt = client.post("/auth/login", json={"email": "deniz@firma.com", "password": "Guclu1234"})
    assert login_attempt.status_code == 401


def test_registration_with_invite_code_links_the_card_and_shows_past_orders(client, db, admin, make_order):
    created = client.post("/customers", headers=auth_headers(admin), json=customer_payload()).json()
    make_order(db.get(Customer, created["id"]), OrderStatus.SHIPPED, "250.00")

    invite = client.post(f"/customers/{created['id']}/invite", headers=auth_headers(admin))
    assert invite.status_code == 201
    code = invite.json()["code"]
    assert INVITE_CODE.match(code)
    detail = client.get(f"/customers/{created['id']}", headers=auth_headers(admin)).json()
    assert detail["invite_expires_at"] == invite.json()["expires_at"]

    # Kod küçük harfle ve tiresiz yazılsa da kabul edilir.
    response = client.post("/auth/register", json=REGISTER_DENIZ | {"invite_code": code.replace("-", "").lower()})

    assert response.status_code == 201
    orders = client.get("/me/orders", headers=login(client, "deniz@firma.com")).json()["items"]
    assert [o["total_amount"] for o in orders] == ["250.00"]
    detail = client.get(f"/customers/{created['id']}", headers=auth_headers(admin)).json()
    assert (detail["has_account"], detail["invite_expires_at"]) == (True, None)


def test_invite_code_is_valid_for_seven_days(client, admin, make_customer):
    card = make_customer(email="deniz@firma.com")
    before = datetime.now(UTC)

    body = client.post(f"/customers/{card.id}/invite", headers=auth_headers(admin)).json()

    expires_at = datetime.fromisoformat(body["expires_at"])
    assert before + timedelta(days=7) <= expires_at <= datetime.now(UTC) + timedelta(days=7)


def test_new_invite_code_replaces_the_previous_one(client, admin, make_customer):
    card = make_customer(email="deniz@firma.com")
    first = client.post(f"/customers/{card.id}/invite", headers=auth_headers(admin)).json()["code"]
    second = client.post(f"/customers/{card.id}/invite", headers=auth_headers(admin)).json()["code"]

    old = client.post("/auth/register", json=REGISTER_DENIZ | {"invite_code": first})
    new = client.post("/auth/register", json=REGISTER_DENIZ | {"invite_code": second})

    assert (old.status_code, old.json()["code"]) == (400, "INVALID_INVITE_CODE")
    assert new.status_code == 201


def test_changing_the_card_email_revokes_the_invite_code(client, admin, make_customer):
    card = make_customer(email="eski@firma.com")
    client.post(f"/customers/{card.id}/invite", headers=auth_headers(admin))

    body = client.put(
        f"/customers/{card.id}", headers=auth_headers(admin), json=customer_payload(email="yeni@firma.com")
    ).json()

    assert body["invite_expires_at"] is None


@pytest.mark.parametrize(
    ("fields", "status", "code"),
    [
        ({"source": RecordSource.OLIST}, 400, "READ_ONLY"),
        ({"is_active": False}, 400, "CUSTOMER_INACTIVE"),
    ],
)
def test_invite_code_cannot_be_created_for_olist_or_inactive_cards(client, admin, make_customer, fields, status, code):
    card = make_customer(**fields)

    response = client.post(f"/customers/{card.id}/invite", headers=auth_headers(admin))

    assert (response.status_code, response.json()["code"]) == (status, code)


def test_invite_code_cannot_be_created_for_a_card_with_an_account(client, admin, customer):
    response = client.post(f"/customers/{customer.customer.id}/invite", headers=auth_headers(admin))

    assert (response.status_code, response.json()["code"]) == (409, "HAS_ACCOUNT")


def test_invite_code_is_admin_only(client, warehouse, make_customer):
    card = make_customer()

    response = client.post(f"/customers/{card.id}/invite", headers=auth_headers(warehouse))

    assert response.status_code == 403


def test_duplicate_email_conflicts(client, admin, make_customer):
    make_customer(email="ayni@example.com")

    response = client.post("/customers", headers=auth_headers(admin), json=customer_payload(email="AYNI@example.com"))

    assert response.status_code == 409
    assert response.json()["details"][0]["field"] == "email"


def test_update_card_without_account(client, admin, make_customer):
    card = make_customer(email="eski@example.com")

    response = client.put(
        f"/customers/{card.id}", headers=auth_headers(admin), json=customer_payload(email="yeni@example.com")
    )

    assert response.status_code == 200
    assert response.json()["email"] == "yeni@example.com"
    assert response.json()["company_name"] == "Ak Ticaret"


def test_email_of_a_customer_with_account_is_locked(client, admin, customer):
    card = customer.customer

    changed = client.put(
        f"/customers/{card.id}",
        headers=auth_headers(admin),
        json=customer_payload(email="baska@example.com"),
    )
    renamed = client.put(
        f"/customers/{card.id}",
        headers=auth_headers(admin),
        json=customer_payload(email=card.email, full_name="Yeni Ad"),
    )

    assert changed.status_code == 400
    assert changed.json()["code"] == "EMAIL_LOCKED"
    assert renamed.status_code == 200
    assert customer.full_name == "Yeni Ad"  # giriş hesabındaki ad da güncellenir


def test_olist_customers_are_read_only(client, admin, make_customer):
    card = make_customer(source=RecordSource.OLIST)

    response = client.put(f"/customers/{card.id}", headers=auth_headers(admin), json=customer_payload())

    assert response.json()["code"] == "READ_ONLY"


def test_deactivate_customer(client, admin, make_customer):
    card = make_customer()

    response = client.patch(f"/customers/{card.id}/status", headers=auth_headers(admin), json={"is_active": False})

    assert response.json()["is_active"] is False


# --- Detay ve sipariş geçmişi ---


def test_detail_stats_and_average_basket(client, admin, make_customer, make_order):
    buyer = make_customer()
    make_order(buyer, OrderStatus.COMPLETED, "100.00")
    make_order(buyer, OrderStatus.SHIPPED, "50.00")
    make_order(buyer, OrderStatus.CANCELLED, "500.00")

    stats = client.get(f"/customers/{buyer.id}", headers=auth_headers(admin)).json()["stats"]

    assert stats["order_count"] == 3
    assert stats["revenue_order_count"] == 2
    assert stats["total_spent"] == "150.00"
    assert stats["average_basket"] == "75.00"


def test_customer_order_history(client, admin, make_customer, make_order):
    buyer = make_customer()
    other = make_customer()
    old = make_order(buyer, OrderStatus.COMPLETED, "100.00", days_ago=40)
    recent = make_order(buyer, OrderStatus.PENDING, "20.00", days_ago=1)
    make_order(other, OrderStatus.COMPLETED, "10.00")

    everything = client.get(f"/customers/{buyer.id}/orders", headers=auth_headers(admin)).json()
    completed = client.get(
        f"/customers/{buyer.id}/orders", headers=auth_headers(admin), params={"status": "completed"}
    ).json()

    assert [o["id"] for o in everything["items"]] == [recent.id, old.id]
    assert everything["items"][0]["item_count"] == 1
    assert [o["id"] for o in completed["items"]] == [old.id]


def test_missing_customer_is_404(client, admin):
    assert client.get("/customers/999999", headers=auth_headers(admin)).status_code == 404
