import os
from pathlib import Path

from dotenv import dotenv_values

BACKEND_DIR = Path(__file__).resolve().parents[1]

# Testler ayrı bir veritabanında çalışır. TEST_DATABASE_URL ortam değişkeninden
# ya da backend/.env dosyasından okunur ve uygulamanın DATABASE_URL'inin yerine geçer.
_env_file = dotenv_values(BACKEND_DIR / ".env")
_test_db_url = os.getenv("TEST_DATABASE_URL") or _env_file.get("TEST_DATABASE_URL")
if not _test_db_url:
    raise RuntimeError("TEST_DATABASE_URL tanımlı değil. backend/.env.example dosyasına bakın.")
os.environ["DATABASE_URL"] = _test_db_url
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only")

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
from app.models import Customer, User, UserRole  # noqa: E402


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
