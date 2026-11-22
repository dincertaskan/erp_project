from sqlalchemy import func, select

from app.core.security import verify_password
from app.models import Customer, Product, StockMovement, User, UserRole
from app.seed import PRODUCTS, seed

PASSWORD = "Demo1234"


def counts(db):
    return {model.__name__: db.scalar(select(func.count()).select_from(model)) for model in (User, Product, Customer)}


def test_seed_creates_one_account_per_role(db):
    seed(db, PASSWORD)

    roles = set(db.scalars(select(User.role)))
    assert roles == {UserRole.ADMIN, UserRole.WAREHOUSE, UserRole.CUSTOMER}
    admin = db.scalar(select(User).where(User.role == UserRole.ADMIN))
    assert verify_password(PASSWORD, admin.password_hash)


def test_seed_links_customer_account_to_customer_record(db):
    seed(db, PASSWORD)

    customer_user = db.scalar(select(User).where(User.role == UserRole.CUSTOMER))
    assert customer_user.customer is not None
    assert customer_user.customer.email == customer_user.email


def test_seed_records_initial_stock_as_movements(db):
    seed(db, PASSWORD)

    stocked = sum(1 for p in PRODUCTS if p[5] > 0)
    assert db.scalar(select(func.count()).select_from(StockMovement)) == stocked


def test_seed_is_idempotent(db):
    seed(db, PASSWORD)
    first = counts(db)
    seed(db, PASSWORD)

    assert counts(db) == first


def test_seeded_accounts_can_log_in(client, db):
    seed(db, PASSWORD)

    for email in ("yonetici@example.com", "depo@example.com", "musteri@example.com"):
        response = client.post("/auth/login", json={"email": email, "password": PASSWORD})
        assert response.status_code == 200, email
