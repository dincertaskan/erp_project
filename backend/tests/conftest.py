import os
from pathlib import Path

from dotenv import dotenv_values

# Testler ayrı bir veritabanında çalışır. TEST_DATABASE_URL ortam değişkeninden
# ya da backend/.env dosyasından okunur ve uygulamanın DATABASE_URL'inin yerine geçer.
_env_file = dotenv_values(Path(__file__).resolve().parents[1] / ".env")
_test_db_url = os.getenv("TEST_DATABASE_URL") or _env_file.get("TEST_DATABASE_URL")
if not _test_db_url:
    raise RuntimeError("TEST_DATABASE_URL tanımlı değil. backend/.env.example dosyasına bakın.")
os.environ["DATABASE_URL"] = _test_db_url
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client
