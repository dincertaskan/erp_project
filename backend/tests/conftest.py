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
from app.main import app  # noqa: E402


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
