from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.models import AuditEvent, AuditLog, Customer, UserRole
from tests.conftest import TEST_PASSWORD, auth_headers


def logs(db, event: AuditEvent) -> list[AuditLog]:
    return list(db.scalars(select(AuditLog).where(AuditLog.event_type == event).order_by(AuditLog.id)))


def only_log(db, event: AuditEvent) -> AuditLog:
    found = logs(db, event)
    assert len(found) == 1, f"{event} için {len(found)} kayıt var"
    return found[0]


def describe(log: AuditLog) -> tuple:
    return (log.actor_id, log.entity_type, log.entity_id, log.entity_label, log.old_value, log.new_value)


# --- Her olay bir kayıt üretir ---


def test_role_change_is_logged(client, db, admin, make_user):
    target = make_user(UserRole.CUSTOMER)

    client.patch(f"/users/{target.id}/role", headers=auth_headers(admin), json={"role": "warehouse"})

    log = only_log(db, AuditEvent.ROLE_CHANGED)
    assert describe(log) == (admin.id, "user", target.id, target.email, {"role": "customer"}, {"role": "warehouse"})
    assert log.created_at is not None


def test_user_deactivation_is_logged(client, db, admin, make_user):
    target = make_user(UserRole.WAREHOUSE)

    client.patch(f"/users/{target.id}/status", headers=auth_headers(admin), json={"is_active": False})

    log = only_log(db, AuditEvent.USER_STATUS_CHANGED)
    assert describe(log) == (admin.id, "user", target.id, target.email, {"is_active": True}, {"is_active": False})


def test_customer_deactivation_is_logged(client, db, admin):
    card = Customer(full_name="Deniz Ak", email="deniz@firma.com")
    db.add(card)
    db.flush()

    client.patch(f"/customers/{card.id}/status", headers=auth_headers(admin), json={"is_active": False})

    log = only_log(db, AuditEvent.CUSTOMER_STATUS_CHANGED)
    assert describe(log) == (
        admin.id,
        "customer",
        card.id,
        "deniz@firma.com",
        {"is_active": True},
        {"is_active": False},
    )


def test_product_price_and_cost_change_is_logged(client, db, admin, make_product):
    product = make_product(sku="AUD-1", sale_price="100.00", cost_price="60.00")
    payload = {
        "sku": "AUD-1",
        "name": "Yeni Ad",
        "category_id": product.category_id,
        "sale_price": "120.00",
        "cost_price": "60.00",
        "min_stock": 5,
    }

    client.put(f"/products/{product.id}", headers=auth_headers(admin), json=payload)

    # Yalnızca değişen alan kaydedilir; para değerleri metin olarak saklanır.
    log = only_log(db, AuditEvent.PRODUCT_PRICE_CHANGED)
    assert describe(log) == (
        admin.id,
        "product",
        product.id,
        "AUD-1",
        {"sale_price": "100.00"},
        {"sale_price": "120.00"},
    )


def test_product_update_without_price_change_is_not_logged(client, db, admin, make_product):
    product = make_product(sku="AUD-2", sale_price="100.00", cost_price="60.00")
    payload = {
        "sku": "AUD-2",
        "name": "Sadece Ad Değişti",
        "category_id": product.category_id,
        "sale_price": "100.00",
        "cost_price": "60.00",
        "min_stock": 5,
    }

    client.put(f"/products/{product.id}", headers=auth_headers(admin), json=payload)

    assert logs(db, AuditEvent.PRODUCT_PRICE_CHANGED) == []


def test_order_cancellation_by_admin_is_logged(client, db, admin, customer, make_product):
    product = make_product(stock=5)
    order = client.post(
        "/orders",
        headers=auth_headers(admin),
        json={
            "customer_id": customer.customer.id,
            "items": [{"product_id": product.id, "quantity": 1}],
            "payment_method": "bank_transfer",
        },
    ).json()

    client.post(f"/orders/{order['id']}/cancel", headers=auth_headers(admin))

    log = only_log(db, AuditEvent.ORDER_CANCELLED)
    assert describe(log) == (
        admin.id,
        "order",
        order["id"],
        order["order_code"],
        {"status": "pending"},
        {"status": "cancelled"},
    )


def test_order_cancellation_by_customer_is_logged(client, db, customer, make_product):
    product = make_product(stock=5)
    order = client.post(
        "/me/orders",
        headers=auth_headers(customer),
        json={
            "items": [{"product_id": product.id, "quantity": 1, "expected_price": str(product.sale_price)}],
            "payment_method": "credit_card",
            "shipping_address": "Bağdat Cad. No: 5, İstanbul",
        },
    ).json()

    client.post(f"/me/orders/{order['id']}/cancel", headers=auth_headers(customer))

    log = only_log(db, AuditEvent.ORDER_CANCELLED)
    assert (log.actor_id, log.entity_id, log.new_value) == (customer.id, order["id"], {"status": "cancelled"})


def test_failed_login_is_logged_with_email_and_ip(client, db, admin):
    client.post("/auth/login", json={"email": admin.email, "password": "Yanlis1234"})
    client.post("/auth/login", json={"email": "yok@example.com", "password": "Yanlis1234"})

    wrong_password, unknown = logs(db, AuditEvent.LOGIN_FAILED)
    assert describe(wrong_password) == (None, "user", admin.id, admin.email, None, {"reason": "wrong_password"})
    assert describe(unknown) == (None, "user", None, "yok@example.com", None, {"reason": "unknown_email"})
    assert wrong_password.ip_address == "testclient"


def test_successful_login_and_rejected_changes_are_not_logged(client, db, admin):
    client.post("/auth/login", json={"email": admin.email, "password": TEST_PASSWORD})
    # Kendi rolünü değiştirme reddedilir; işlem olmadığı için kayıt da olmaz.
    client.patch(f"/users/{admin.id}/role", headers=auth_headers(admin), json={"role": "warehouse"})

    assert db.scalars(select(AuditLog)).all() == []


# --- İşlem Geçmişi listesi ---


def add_log(db, event: AuditEvent, *, actor=None, at: datetime | None = None) -> AuditLog:
    log = AuditLog(
        event_type=event,
        actor_id=actor.id if actor else None,
        entity_type="user",
        entity_label="kayit@example.com",
        created_at=at or datetime.now(UTC),
    )
    db.add(log)
    db.flush()
    return log


def test_audit_log_list_shows_newest_first_with_actor(client, db, admin):
    older = add_log(db, AuditEvent.ROLE_CHANGED, actor=admin, at=datetime.now(UTC) - timedelta(hours=1))
    newer = add_log(db, AuditEvent.LOGIN_FAILED)

    body = client.get("/audit-logs", headers=auth_headers(admin)).json()

    assert [item["id"] for item in body["items"]] == [newer.id, older.id]
    assert body["items"][0]["actor"] is None
    assert body["items"][1]["actor"] == {"id": admin.id, "full_name": admin.full_name, "email": admin.email}


def test_audit_log_list_filters_by_date_user_and_event_type(client, db, admin, make_user):
    other_admin = make_user(UserRole.ADMIN)
    now = datetime.now(UTC)
    wanted = add_log(db, AuditEvent.ROLE_CHANGED, actor=admin, at=now - timedelta(days=1))
    add_log(db, AuditEvent.ROLE_CHANGED, actor=admin, at=now - timedelta(days=10))  # tarih dışı
    add_log(db, AuditEvent.ROLE_CHANGED, actor=other_admin, at=now - timedelta(days=1))  # başka kullanıcı
    add_log(db, AuditEvent.USER_STATUS_CHANGED, actor=admin, at=now - timedelta(days=1))  # başka olay
    params = {
        "from": (now - timedelta(days=2)).isoformat(),
        "to": now.isoformat(),
        "actor_id": admin.id,
        "event_type": ["role_changed", "order_cancelled"],
    }

    body = client.get("/audit-logs", headers=auth_headers(admin), params=params).json()

    assert [item["id"] for item in body["items"]] == [wanted.id]
    assert body["total"] == 1


def test_audit_log_list_rejects_unknown_event_type(client, admin):
    response = client.get("/audit-logs", headers=auth_headers(admin), params={"event_type": "bilinmeyen"})

    assert response.status_code == 422


def test_only_admins_can_see_the_audit_log(client, warehouse, customer):
    assert client.get("/audit-logs", headers=auth_headers(warehouse)).status_code == 403
    assert client.get("/audit-logs", headers=auth_headers(customer)).status_code == 403
    assert client.get("/audit-logs").status_code == 401
