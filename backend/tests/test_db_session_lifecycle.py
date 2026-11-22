"""Gerçek get_db ile (test geçersiz kılması olmadan): oturum yanıt serileştirilmeden kapandığında da
uç noktalar ilişkili verileri döndürebilmeli."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.core.database import SessionLocal
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
    token = create_access_token(committed_customer, UserRole.CUSTOMER.value)

    with TestClient(app) as client:
        response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["customer"]["city"] == "İzmir"
