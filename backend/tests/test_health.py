def test_health_reports_database_ok(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_pool_timeout_returns_json_503(db):
    from fastapi.testclient import TestClient
    from sqlalchemy.exc import TimeoutError as PoolTimeout

    from app.core.database import get_db
    from app.main import app

    def exhausted_pool():
        raise PoolTimeout("QueuePool limit reached")
        yield  # pragma: no cover

    app.dependency_overrides[get_db] = exhausted_pool
    try:
        with TestClient(app) as client:
            response = client.get("/categories", headers={"Authorization": "Bearer x"})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 503
    assert response.json()["code"] == "SERVER_BUSY"
    assert response.headers["retry-after"] == "1"


def test_unexpected_errors_return_json_500(client, monkeypatch):
    from app.controllers import health_controller

    def boom(*args, **kwargs):
        raise RuntimeError("beklenmeyen")

    monkeypatch.setattr(health_controller, "text", boom)
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app, raise_server_exceptions=False) as raw_client:
        response = raw_client.get("/health")

    assert response.status_code == 500
    assert response.json() == {"code": "INTERNAL_ERROR", "message": "Beklenmeyen bir hata oluştu.", "details": None}
