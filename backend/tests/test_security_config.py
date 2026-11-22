import pytest
from pydantic import ValidationError

from app.core.config import Settings

PREFLIGHT = {"Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization"}


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


@pytest.mark.parametrize("algorithm", ["none", "RS256"])
def test_only_hmac_jwt_algorithms_are_accepted(algorithm):
    with pytest.raises(ValidationError):
        Settings(DATABASE_URL="postgresql://u:p@localhost/db", SECRET_KEY="x" * 32, ALGORITHM=algorithm)
