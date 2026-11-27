import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings, settings
from app.main import create_app

PREFLIGHT = {"Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization"}
DOCS_PATHS = ["/docs", "/docs/oauth2-redirect", "/redoc", "/openapi.json"]
VALID = {"DATABASE_URL": "postgresql://u:p@localhost/db", "SECRET_KEY": "x" * 32}


def test_cors_allows_frontend_origin_without_credentials(client):
    response = client.options("/auth/login", headers={"Origin": "http://localhost:5173", **PREFLIGHT})

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "access-control-allow-credentials" not in response.headers


def test_cors_rejects_unknown_origin(client):
    preflight = client.options("/auth/login", headers={"Origin": "https://evil.example", **PREFLIGHT})
    simple = client.get("/health", headers={"Origin": "https://evil.example"})

    assert preflight.status_code == 400
    assert "access-control-allow-origin" not in simple.headers


@pytest.mark.parametrize("key", ["change-me-to-a-long-random-string", "kisa-anahtar", "x" * 31])
def test_weak_or_placeholder_secret_key_is_rejected(key):
    with pytest.raises(ValidationError, match="SECRET_KEY"):
        Settings(DATABASE_URL="postgresql://u:p@localhost/db", SECRET_KEY=key)


def test_secret_key_of_32_characters_is_accepted():
    assert Settings(DATABASE_URL="postgresql://u:p@localhost/db", SECRET_KEY="x" * 32).SECRET_KEY == "x" * 32


@pytest.mark.parametrize("algorithm", ["none", "RS256"])
def test_only_hmac_jwt_algorithms_are_accepted(algorithm):
    with pytest.raises(ValidationError):
        Settings(DATABASE_URL="postgresql://u:p@localhost/db", SECRET_KEY="x" * 32, ALGORITHM=algorithm)


def test_docs_are_enabled_by_default(monkeypatch):
    monkeypatch.delenv("ENABLE_DOCS", raising=False)

    assert Settings(**VALID, _env_file=None).ENABLE_DOCS is True


def test_docs_can_be_disabled_from_environment(monkeypatch):
    monkeypatch.setenv("ENABLE_DOCS", "false")

    assert Settings(**VALID, _env_file=None).ENABLE_DOCS is False


@pytest.mark.parametrize("path", DOCS_PATHS)
def test_docs_are_served_when_enabled(client, path):
    assert client.get(path).status_code == 200


@pytest.mark.parametrize("path", DOCS_PATHS)
def test_docs_return_404_when_disabled(monkeypatch, path):
    monkeypatch.setattr(settings, "ENABLE_DOCS", False)

    with TestClient(create_app()) as docs_disabled_client:
        response = docs_disabled_client.get(path)

    assert response.status_code == 404
