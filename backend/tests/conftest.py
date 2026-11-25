import os
from decimal import Decimal
from pathlib import Path

from dotenv import dotenv_values
from sqlalchemy.engine import make_url

BACKEND_DIR = Path(__file__).resolve().parents[1]

# Testler ayrı bir veritabanında çalışır. TEST_DATABASE_URL ortam değişkeninden
# ya da backend/.env dosyasından okunur ve uygulamanın DATABASE_URL'inin yerine geçer.
_env_file = dotenv_values(BACKEND_DIR / ".env")
_test_db_url = os.getenv("TEST_DATABASE_URL") or _env_file.get("TEST_DATABASE_URL")
if not _test_db_url:
    raise RuntimeError("TEST_DATABASE_URL tanımlı değil. backend/.env.example dosyasına bakın.")
# Oturum başında şema silinir; yanlışlıkla geliştirme ya da demo veritabanına bağlanılmasın.
_test_db_name = make_url(_test_db_url).database or ""
if not _test_db_name.endswith("_test"):
    raise RuntimeError(
        f"TEST_DATABASE_URL '{_test_db_name}' veritabanını gösteriyor. Testler şemayı sildiği için "
        "veritabanı adı '_test' ile bitmelidir."
    )
os.environ["DATABASE_URL"] = _test_db_url
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only-not-for-production")

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.core.database import engine, get_db  # noqa: E402
from app.core.login_throttle import login_throttle  # noqa: E402
from app.core.security import create_access_token, hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Category, Customer, Product, User, UserRole  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def migrated_database():
    """Test veritabanını her oturumda sıfırlayıp tüm göçleri uygular."""
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
    command.upgrade(Config(str(BACKEND_DIR / "alembic.ini")), "head")
    yield


@pytest.fixture
def db():
    """Her test kendi işleminde çalışır ve sonunda geri alınır; commit'ler savepoint'e dönüşür."""
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False)
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


TEST_PASSWORD = "Test1234"


@pytest.fixture(autouse=True)
def reset_login_throttle():
    login_throttle.reset()
    yield
    login_throttle.reset()


@pytest.fixture
def make_user(db):
    counter = {"n": 0}

    def factory(role: UserRole = UserRole.CUSTOMER, *, is_active: bool = True, email: str | None = None) -> User:
        counter["n"] += 1
        user = User(
            full_name=f"Test {role.value} {counter['n']}",
            email=email or f"{role.value}{counter['n']}@example.com",
            password_hash=hash_password(TEST_PASSWORD),
            role=role,
            is_active=is_active,
        )
        db.add(user)
        db.flush()
        if role == UserRole.CUSTOMER:
            db.add(Customer(user_id=user.id, full_name=user.full_name, email=user.email))
            db.flush()
        return user

    return factory


def auth_headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id, user.role.value)}"}


@pytest.fixture
def admin(make_user):
    return make_user(UserRole.ADMIN)


@pytest.fixture
def warehouse(make_user):
    return make_user(UserRole.WAREHOUSE)


@pytest.fixture
def customer(make_user):
    return make_user(UserRole.CUSTOMER)


@pytest.fixture
def make_category(db):
    counter = {"n": 0}

    def factory(name: str | None = None, *, is_active: bool = True) -> Category:
        counter["n"] += 1
        category = Category(name=name or f"Test Kategori {counter['n']}", is_active=is_active)
        db.add(category)
        db.flush()
        return category

    return factory


@pytest.fixture
def make_product(db, make_category):
    counter = {"n": 0}

    def factory(
        category: Category | None = None,
        *,
        sku: str | None = None,
        name: str | None = None,
        stock: int = 10,
        min_stock: int = 5,
        sale_price: str = "100.00",
        cost_price: str = "60.00",
        is_active: bool = True,
    ) -> Product:
        counter["n"] += 1
        product = Product(
            sku=sku or f"TST-{counter['n']:04d}",
            name=name or f"Test Ürün {counter['n']}",
            category=category or make_category(),
            stock=stock,
            min_stock=min_stock,
            sale_price=Decimal(sale_price),
            cost_price=Decimal(cost_price),
            is_active=is_active,
        )
        db.add(product)
        db.flush()
        return product

    return factory
