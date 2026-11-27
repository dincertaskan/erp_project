"""Gerçek get_db ile (test geçersiz kılması olmadan): oturum yanıt serileştirilmeden kapandığında da
uç noktalar ilişkili verileri döndürebilmeli."""

import anyio
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, text

from app.core import database
from app.core.database import SessionLocal, get_db
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models import Customer, User, UserRole


@pytest.fixture
def committed_customer():
    with SessionLocal() as session:
        user = User(
            full_name="Oturum Testi",
            email="session-lifecycle@example.com",
            password_hash=hash_password("Test1234"),
            role=UserRole.CUSTOMER,
        )
        session.add(user)
        session.flush()
        session.add(Customer(user_id=user.id, full_name=user.full_name, email=user.email, city="İzmir"))
        session.commit()
        user_id = user.id
    yield user_id
    with SessionLocal() as session:
        session.execute(delete(Customer).where(Customer.user_id == user_id))
        session.execute(delete(User).where(User.id == user_id))
        session.commit()


def test_me_returns_customer_profile_with_real_sessions(committed_customer):
    app.dependency_overrides.clear()
    token = create_access_token(committed_customer, UserRole.CUSTOMER.value, 0)

    with TestClient(app) as client:
        response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["customer"]["city"] == "İzmir"


@pytest.mark.parametrize("open_transaction", [True, False])
def test_get_db_closes_open_transaction_in_a_worker_thread(monkeypatch, open_transaction):
    calls = []
    real = database.run_in_threadpool

    async def recording(func, *args):
        calls.append(func)
        return await real(func, *args)

    monkeypatch.setattr(database, "run_in_threadpool", recording)

    async def request():
        dependency = get_db()
        db = await anext(dependency)
        if open_transaction:
            db.execute(text("SELECT 1"))  # uç nokta hata verip işlem açık kalmış gibi
        await dependency.aclose()
        return db

    db = anyio.run(request)

    assert len(calls) == (1 if open_transaction else 0)
    assert not db.in_transaction()
