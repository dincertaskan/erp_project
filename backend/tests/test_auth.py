from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.core import invite_codes, security
from app.core.config import Settings, settings
from app.core.database import get_db
from app.core.rate_limit import register_throttle
from app.main import app, create_app
from app.models import Customer, LoginAttempt, RecordSource, User, UserRole
from app.services.login_throttle import LoginThrottle
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


@pytest.fixture
def card(db):
    """Yöneticinin uygulamada açtığı, henüz hesabı olmayan müşteri kartı."""
    card = Customer(full_name="Can Demir", email="can@example.com", city="Ankara")
    db.add(card)
    db.flush()
    return card


def test_register_does_not_link_an_app_card_without_invite_code(client, db, card):
    response = client.post("/auth/register", json=REGISTER)

    assert response.status_code == 400
    assert response.json()["code"] == "INVITE_CODE_REQUIRED"
    db.refresh(card)
    assert card.user_id is None
    assert db.scalar(select(User).where(User.email == "can@example.com")) is None


def test_register_links_an_app_card_with_its_invite_code(client, db, card):
    code = invite_codes.issue(card)
    db.flush()

    response = client.post("/auth/register", json=REGISTER | {"invite_code": code, "phone": "0532 000 00 00"})

    assert response.status_code == 201
    db.refresh(card)
    assert card.user_id == response.json()["id"]
    assert card.phone == "0532 000 00 00"


def test_invite_code_is_single_use(client, db, card):
    code = invite_codes.issue(card)
    db.flush()
    client.post("/auth/register", json=REGISTER | {"invite_code": code})

    db.refresh(card)
    assert (card.invite_code_digest, card.invite_expires_at) == (None, None)
    assert not invite_codes.accepts(card, code)


@pytest.mark.parametrize("case", ["wrong", "expired", "inactive_card", "no_card"])
def test_register_rejects_an_unusable_invite_code_with_400(client, db, card, case):
    code = invite_codes.issue(card)
    email = REGISTER["email"]
    if case == "wrong":
        code = "AAAAA-AAAAA"
    elif case == "expired":
        card.invite_expires_at = datetime.now(UTC) - timedelta(seconds=1)
    elif case == "inactive_card":
        card.is_active = False
    else:
        email = "baska@example.com"
    db.flush()

    response = client.post("/auth/register", json=REGISTER | {"email": email, "invite_code": code})

    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "INVALID_INVITE_CODE"
    assert body["message"] == "Davet kodu geçersiz ya da süresi dolmuş. Mağazadan yeni bir kod isteyin."
    assert body["details"] == [{"field": "invite_code", "message": body["message"]}]
    db.refresh(card)
    assert card.user_id is None


def test_register_rejects_an_email_whose_card_already_has_an_account(client, db, customer):
    # Hesaba bağlı kart, farklı e-postalı bir hesaba bağlı olsa bile ikinci bir hesaba verilmez.
    customer.customer.email = "kart@example.com"
    db.flush()

    response = client.post("/auth/register", json=REGISTER | {"email": "kart@example.com"})

    assert (response.status_code, response.json()["code"]) == (409, "EMAIL_TAKEN")


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
    assert int(response.headers["retry-after"]) == response.json()["details"]["retry_after"]


def fail_login(test_client, email: str):
    return test_client.post("/auth/login", json={"email": email, "password": "Yanlis1234"})


def test_ip_is_blocked_after_20_failures_with_different_emails(client, admin):
    for n in range(19):
        assert fail_login(client, f"tahmin{n}@example.com").status_code == 401
    # 19 hatalı denemede IP henüz engelli değil. Kendi hesabına girmek IP sayacını temizlemez.
    assert client.post("/auth/login", json={"email": admin.email, "password": TEST_PASSWORD}).status_code == 200
    fail_login(client, "tahmin19@example.com")

    response = client.post("/auth/login", json={"email": admin.email, "password": TEST_PASSWORD})

    assert response.status_code == 429
    assert response.json()["message"] == "Çok fazla hatalı deneme yapıldı. 15 dakika sonra tekrar deneyin."
    assert 14 * 60 < int(response.headers["retry-after"]) <= 15 * 60 + 1
    with TestClient(app, client=("203.0.113.7", 50000)) as other_ip:
        assert other_ip.post("/auth/login", json={"email": admin.email, "password": TEST_PASSWORD}).status_code == 200


def test_email_is_blocked_from_every_ip_after_5_failures(client, admin):
    for _ in range(5):
        fail_login(client, admin.email.upper())

    with TestClient(app, client=("203.0.113.7", 50000)) as other_ip:
        response = other_ip.post("/auth/login", json={"email": admin.email, "password": TEST_PASSWORD})

    assert response.status_code == 429


@pytest.mark.parametrize(("minutes_ago", "blocked"), [(14, True), (16, False)])
def test_ip_block_lasts_15_minutes(db, minutes_ago, blocked):
    at = datetime.now(UTC) - timedelta(minutes=minutes_ago)
    db.add_all(LoginAttempt(email=f"t{n}@example.com", ip_address="198.51.100.1", created_at=at) for n in range(20))
    db.flush()

    retry_after = LoginThrottle(db).retry_after("yeni@example.com", "198.51.100.1")

    assert (retry_after > 0) is blocked
    if blocked:
        assert retry_after <= 60 + 1


def test_login_failures_survive_an_application_restart(client, db, admin):
    for _ in range(5):
        fail_login(client, admin.email)

    # Yeni uygulama örneği bellekte hiçbir sayaç taşımaz; sayaç veritabanından okunur.
    restarted = create_app()
    restarted.dependency_overrides[get_db] = lambda: db
    with TestClient(restarted) as fresh_client:
        response = fresh_client.post("/auth/login", json={"email": admin.email, "password": TEST_PASSWORD})

    assert response.status_code == 429
    assert db.scalar(select(func.count()).where(LoginAttempt.email == admin.email.lower())) == 5


def test_expired_login_attempts_are_cleaned_up(client, db):
    db.add(
        LoginAttempt(
            email="eski@example.com", ip_address="198.51.100.1", created_at=datetime.now(UTC) - timedelta(hours=1)
        )
    )
    db.flush()

    fail_login(client, "yeni@example.com")

    assert db.scalars(select(LoginAttempt.email)).all() == ["yeni@example.com"]


# --- Kayıt hız sınırı ---


@pytest.fixture
def low_register_limit(monkeypatch):
    """Testlerde sınır düşük tutulur: 10 dakikada 2 deneme."""
    monkeypatch.setattr(register_throttle, "max_attempts", 2)
    monkeypatch.setattr(register_throttle, "window_seconds", 10 * 60)


def register_as(test_client, n: int):
    return test_client.post("/auth/register", json=REGISTER | {"email": f"kayit{n}@example.com"})


def test_register_is_rate_limited_per_ip(client, low_register_limit):
    assert [register_as(client, n).status_code for n in range(2)] == [201, 201]

    response = register_as(client, 3)

    assert response.status_code == 429
    body = response.json()
    assert body["code"] == "TOO_MANY_REQUESTS"
    assert body["message"] == "Çok fazla deneme yapıldı, 10 dakika sonra tekrar deneyin."
    assert 0 < int(response.headers["retry-after"]) <= 600
    assert int(response.headers["retry-after"]) == body["details"]["retry_after"]


def test_register_limit_does_not_block_other_ips(client, low_register_limit):
    for n in range(3):
        register_as(client, n)

    with TestClient(app, client=("203.0.113.7", 50000)) as other_ip:
        assert register_as(other_ip, 9).status_code == 201


def test_failed_registrations_count_towards_the_limit(client, low_register_limit, customer):
    # Başarısız denemeler de bcrypt çalıştırır ve davet kodu tahmininde kullanılabilir.
    for _ in range(2):
        assert client.post("/auth/register", json=REGISTER | {"email": customer.email}).status_code == 409

    assert register_as(client, 1).status_code == 429


def test_register_limit_is_read_from_environment(monkeypatch):
    monkeypatch.setenv("REGISTER_RATE_LIMIT", "3")
    monkeypatch.setenv("REGISTER_RATE_WINDOW_MINUTES", "1")

    configured = Settings(DATABASE_URL="postgresql://u:p@localhost/db", SECRET_KEY="x" * 32, _env_file=None)

    assert (configured.REGISTER_RATE_LIMIT, configured.REGISTER_RATE_WINDOW_MINUTES) == (3, 1)
    assert register_throttle.max_attempts == settings.REGISTER_RATE_LIMIT
    assert register_throttle.window_seconds == settings.REGISTER_RATE_WINDOW_MINUTES * 60


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
    assert ok.status_code == 200
    login = client.post("/auth/login", json={"email": customer.email, "password": "Yeni12345"})
    assert login.status_code == 200


# --- Token iptali ---


def login_token(test_client, email: str, password: str = TEST_PASSWORD) -> dict[str, str]:
    token = test_client.post("/auth/login", json={"email": email, "password": password}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_old_tokens_are_rejected_after_password_change(client, customer):
    other_device = login_token(client, customer.email)
    this_device = login_token(client, customer.email)

    response = client.post(
        "/auth/me/password", headers=this_device, json={"current_password": TEST_PASSWORD, "new_password": "Yeni12345"}
    )

    assert response.status_code == 200
    # Şifreyi değiştiren oturum yanıttaki yeni token'la sürer; eski token'lar (bu cihazınki dahil) reddedilir.
    new_token = {"Authorization": f"Bearer {response.json()['access_token']}"}
    assert response.json()["user"]["email"] == customer.email
    assert client.get("/auth/me", headers=new_token).status_code == 200
    for old in (other_device, this_device):
        rejected = client.get("/auth/me", headers=old)
        assert rejected.status_code == 401
        assert rejected.json()["code"] == "INVALID_TOKEN"


def test_logout_revokes_the_token_on_the_server(client, customer):
    headers = login_token(client, customer.email)

    assert client.post("/auth/logout", headers=headers).status_code == 204

    response = client.get("/auth/me", headers=headers)
    assert response.status_code == 401
    assert response.json()["message"] == "Oturumunuz sonlandırıldı. Lütfen tekrar giriş yapın."
    assert client.post("/auth/logout", headers=headers).status_code == 401


def test_logout_ends_sessions_on_all_devices_and_allows_logging_in_again(client, customer):
    phone = login_token(client, customer.email)
    laptop = login_token(client, customer.email)

    client.post("/auth/logout", headers=laptop)

    assert client.get("/auth/me", headers=phone).status_code == 401
    assert client.get("/auth/me", headers=login_token(client, customer.email)).status_code == 200


def test_logout_requires_a_token(client):
    assert client.post("/auth/logout").status_code == 401
