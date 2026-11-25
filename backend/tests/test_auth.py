from sqlalchemy import select

from app.core import security
from app.models import Customer, RecordSource, User, UserRole
from tests.conftest import TEST_PASSWORD, auth_headers

REGISTER = {"full_name": "Can Demir", "email": "Can@Example.com", "password": "Guclu1234"}


def test_register_creates_customer_account_with_customer_record(client, db):
    response = client.post("/auth/register", json=REGISTER)

    assert response.status_code == 201
    body = response.json()
    assert body["role"] == "customer"
    assert body["email"] == "can@example.com"
    user = db.scalar(select(User).where(User.email == "can@example.com"))
    assert user.customer is not None


def test_register_rejects_role_field(client):
    response = client.post("/auth/register", json=REGISTER | {"role": "admin"})

    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"


def test_register_rejects_weak_password_with_field_message(client):
    response = client.post("/auth/register", json=REGISTER | {"password": "kisa"})

    assert response.status_code == 422
    detail = response.json()["details"][0]
    assert detail["field"] == "password"
    assert detail["message"] == "Şifre en az 8 karakter olmalıdır."


def test_register_rejects_duplicate_email_case_insensitively(client, customer):
    response = client.post("/auth/register", json=REGISTER | {"email": customer.email.upper()})

    assert response.status_code == 409
    assert response.json()["code"] == "EMAIL_TAKEN"


def test_register_links_existing_customer_card(client, db):
    card = Customer(full_name="Can Demir", email="can@example.com", city="Ankara")
    db.add(card)
    db.flush()

    response = client.post("/auth/register", json=REGISTER)

    assert response.status_code == 201
    db.refresh(card)
    assert card.user_id == response.json()["id"]


def test_register_never_links_an_olist_customer_card(client, db):
    card = Customer(full_name="Olist Müşterisi", email="olist-00001@example.com", source=RecordSource.OLIST)
    db.add(card)
    db.flush()

    response = client.post("/auth/register", json=REGISTER | {"email": "OLIST-00001@example.com"})

    assert response.status_code == 409
    assert response.json()["code"] == "EMAIL_TAKEN"
    db.refresh(card)
    assert card.user_id is None
    assert db.scalar(select(User).where(User.email == "olist-00001@example.com")) is None


def test_login_returns_token_and_user(client, admin):
    response = client.post("/auth/login", json={"email": admin.email, "password": TEST_PASSWORD})

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["role"] == "admin"
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.json()["id"] == admin.id


def test_bcrypt_runs_without_an_open_transaction(client, db, admin, monkeypatch):
    seen = []

    def record(original):
        def wrapper(*args):
            seen.append(db.in_transaction())
            return original(*args)

        return wrapper

    monkeypatch.setattr("app.services.auth_service.verify_password", record(security.verify_password))
    monkeypatch.setattr("app.services.auth_service.hash_password", record(security.hash_password))

    login = client.post("/auth/login", json={"email": admin.email, "password": TEST_PASSWORD})
    register = client.post("/auth/register", json=REGISTER)

    assert (login.status_code, register.status_code) == (200, 201)
    assert seen == [False, False]
    db.refresh(admin)
    assert admin.last_login_at is not None


def test_login_with_wrong_password_is_rejected(client, admin):
    response = client.post("/auth/login", json={"email": admin.email, "password": "Yanlis1234"})

    assert response.status_code == 401
    assert response.json()["code"] == "INVALID_CREDENTIALS"


def test_login_of_inactive_account_is_rejected(client, make_user):
    user = make_user(UserRole.WAREHOUSE, is_active=False)

    response = client.post("/auth/login", json={"email": user.email, "password": TEST_PASSWORD})

    assert response.status_code == 403
    assert response.json()["code"] == "ACCOUNT_INACTIVE"


def test_login_is_blocked_after_repeated_failures(client, admin):
    for _ in range(5):
        client.post("/auth/login", json={"email": admin.email, "password": "Yanlis1234"})

    response = client.post("/auth/login", json={"email": admin.email, "password": TEST_PASSWORD})

    assert response.status_code == 429
    assert response.json()["details"]["retry_after"] > 0


def test_me_requires_token(client):
    response = client.get("/auth/me")

    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHORIZED"


def test_me_rejects_invalid_token(client):
    response = client.get("/auth/me", headers={"Authorization": "Bearer gecersiz"})

    assert response.status_code == 401
    assert response.json()["code"] == "INVALID_TOKEN"


def test_token_of_deactivated_user_stops_working(client, db, warehouse):
    headers = auth_headers(warehouse)
    warehouse.is_active = False
    db.flush()

    response = client.get("/auth/me", headers=headers)

    assert response.status_code == 401
    assert response.json()["code"] == "ACCOUNT_INACTIVE"


def test_customer_updates_profile(client, customer):
    response = client.patch("/auth/me", headers=auth_headers(customer), json={"full_name": "Yeni Ad", "city": "İzmir"})

    assert response.status_code == 200
    assert response.json()["full_name"] == "Yeni Ad"
    assert response.json()["customer"]["city"] == "İzmir"


def test_staff_cannot_set_customer_only_fields(client, warehouse):
    response = client.patch("/auth/me", headers=auth_headers(warehouse), json={"city": "İzmir"})

    assert response.status_code == 400
    assert response.json()["code"] == "NOT_A_CUSTOMER"


def test_change_password_requires_current_password(client, customer):
    headers = auth_headers(customer)

    wrong = client.post(
        "/auth/me/password", headers=headers, json={"current_password": "Yanlis1234", "new_password": "Yeni12345"}
    )
    assert wrong.status_code == 400
    assert wrong.json()["code"] == "INVALID_PASSWORD"

    ok = client.post(
        "/auth/me/password", headers=headers, json={"current_password": TEST_PASSWORD, "new_password": "Yeni12345"}
    )
    assert ok.status_code == 204
    login = client.post("/auth/login", json={"email": customer.email, "password": "Yeni12345"})
    assert login.status_code == 200
