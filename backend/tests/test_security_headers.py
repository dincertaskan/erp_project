import pytest

from app.core.security_headers import API_CSP

COMMON = {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
}


def assert_common_headers(response):
    for name, value in COMMON.items():
        assert response.headers[name] == value


@pytest.mark.parametrize("path", ["/health", "/products", "/bilinmeyen-yol"])
def test_api_responses_carry_security_headers(client, path):
    # Başarılı, 401 ve 404 yanıtlarında da başlıklar bulunur.
    response = client.get(path)

    assert_common_headers(response)
    assert response.headers["content-security-policy"] == API_CSP


def test_cors_preflight_carries_security_headers(client):
    response = client.options(
        "/auth/login",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"},
    )

    assert response.status_code == 200
    assert_common_headers(response)


@pytest.mark.parametrize("path", ["/docs", "/redoc", "/openapi.json"])
def test_docs_pages_work_without_csp(client, path):
    response = client.get(path)

    assert response.status_code == 200
    assert_common_headers(response)
    assert "content-security-policy" not in response.headers
