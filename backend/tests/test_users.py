import threading

import pytest
from sqlalchemy import delete, func, select

from app.core.database import SessionLocal
from app.core.errors import ConflictError
from app.core.security import hash_password
from app.models import Customer, RecordSource, User, UserRole
from app.repositories.user_repository import UserRepository
from app.services.user_service import UserService
from tests.conftest import auth_headers


def test_admin_lists_users_with_filters_and_pagination(client, admin, make_user):
    for _ in range(3):
        make_user(UserRole.WAREHOUSE)
    make_user(UserRole.CUSTOMER)

    response = client.get("/users", headers=auth_headers(admin), params={"role": "warehouse", "page_size": 2})

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 3
    assert len(body["items"]) == 2
    assert {u["role"] for u in body["items"]} == {"warehouse"}


def test_admin_searches_users_by_name_or_email(client, admin, make_user):
    target = make_user(UserRole.WAREHOUSE, email="ayse.depo@example.com")

    response = client.get("/users", headers=auth_headers(admin), params={"search": "ayse.depo"})

    assert [u["id"] for u in response.json()["items"]] == [target.id]


def test_admin_assigns_warehouse_role(client, admin, customer):
    response = client.patch(f"/users/{customer.id}/role", headers=auth_headers(admin), json={"role": "warehouse"})

    assert response.status_code == 200
    assert response.json()["role"] == "warehouse"


def test_assigning_customer_role_creates_customer_record(client, db, admin, warehouse):
    response = client.patch(f"/users/{warehouse.id}/role", headers=auth_headers(admin), json={"role": "customer"})

    assert response.status_code == 200
    db.refresh(warehouse)
    assert warehouse.customer is not None


def test_admin_deactivates_and_reactivates_user(client, admin, warehouse):
    off = client.patch(f"/users/{warehouse.id}/status", headers=auth_headers(admin), json={"is_active": False})
    on = client.patch(f"/users/{warehouse.id}/status", headers=auth_headers(admin), json={"is_active": True})

    assert off.json()["is_active"] is False
    assert on.json()["is_active"] is True


def test_admin_cannot_change_own_role_or_status(client, admin):
    role = client.patch(f"/users/{admin.id}/role", headers=auth_headers(admin), json={"role": "warehouse"})
    status = client.patch(f"/users/{admin.id}/status", headers=auth_headers(admin), json={"is_active": False})

    assert role.json()["code"] == "SELF_CHANGE"
    assert status.json()["code"] == "SELF_CHANGE"


def test_admin_can_be_deactivated_while_another_admin_is_active(client, admin, make_user):
    other = make_user(UserRole.ADMIN)

    response = client.patch(f"/users/{other.id}/status", headers=auth_headers(admin), json={"is_active": False})

    assert response.status_code == 200


def test_last_active_admin_cannot_be_deactivated_or_demoted(db, make_user):
    only_admin = make_user(UserRole.ADMIN)
    inactive_admin = make_user(UserRole.ADMIN, is_active=False)
    service = UserService(db)

    with pytest.raises(ConflictError) as demote:
        service.set_role(inactive_admin, only_admin.id, UserRole.WAREHOUSE)
    with pytest.raises(ConflictError) as deactivate:
        service.set_status(inactive_admin, only_admin.id, False)

    assert demote.value.code == "LAST_ADMIN"
    assert deactivate.value.code == "LAST_ADMIN"


@pytest.fixture
def two_committed_admins():
    with SessionLocal() as session:
        admins = [
            User(full_name=f"Yarış Yönetici {n}", email=f"race-admin-{n}@example.com", password_hash=hash_password("x"))
            for n in (1, 2)
        ]
        for admin in admins:
            admin.role = UserRole.ADMIN
        session.add_all(admins)
        session.commit()
        ids = [admin.id for admin in admins]
    yield ids
    with SessionLocal() as session:
        session.execute(delete(User).where(User.id.in_(ids)))
        session.commit()


def test_concurrent_demotions_cannot_remove_every_admin(two_committed_admins):
    first_id, second_id = two_committed_admins
    with SessionLocal() as session:
        active = select(func.count()).select_from(User).where(User.role == UserRole.ADMIN, User.is_active)
        assert session.scalar(active) == 2

    holder = SessionLocal()
    result: dict = {}

    def demote_first():
        # İkinci yönetici, birincisini düşürmeye çalışır; kilit serbest kalana kadar beklemelidir.
        with SessionLocal() as session:
            try:
                UserService(session).set_role(session.get(User, second_id), first_id, UserRole.WAREHOUSE)
                result["outcome"] = "demoted"
            except ConflictError as exc:
                result["outcome"] = exc.code

    try:
        # Birinci yönetici, ikincisini düşüren işlemi kilit alıp henüz commit etmeden tutar.
        assert UserRepository(holder).lock_active_admin_ids() == {first_id, second_id}
        worker = threading.Thread(target=demote_first)
        worker.start()
        worker.join(timeout=0.5)
        assert worker.is_alive(), "ikinci istek kilidi beklemeden ilerledi"
        holder.get(User, second_id).role = UserRole.WAREHOUSE
        holder.commit()
        worker.join(timeout=10)
    finally:
        holder.close()

    assert result["outcome"] == "LAST_ADMIN"
    with SessionLocal() as session:
        assert session.scalar(active) == 1


def test_role_change_never_links_an_olist_customer_card(db, admin, make_user):
    staff = make_user(UserRole.WAREHOUSE, email="olist-00002@example.com")
    card = Customer(full_name="Olist Müşterisi", email="olist-00002@example.com", source=RecordSource.OLIST)
    db.add(card)
    db.flush()

    with pytest.raises(ConflictError) as caught:
        UserService(db).set_role(admin, staff.id, UserRole.CUSTOMER)

    assert caught.value.code == "EMAIL_TAKEN"
    assert (staff.role, card.user_id) == (UserRole.WAREHOUSE, None)


def test_unknown_user_returns_404(client, admin):
    response = client.patch("/users/999999/status", headers=auth_headers(admin), json={"is_active": False})

    assert response.status_code == 404
    assert response.json()["code"] == "NOT_FOUND"


ADMIN_ONLY_ENDPOINTS = [
    ("get", "/users", None),
    ("patch", "/users/1/role", {"role": "warehouse"}),
    ("patch", "/users/1/status", {"is_active": False}),
]


@pytest.mark.parametrize(("method", "path", "body"), ADMIN_ONLY_ENDPOINTS)
@pytest.mark.parametrize("role", [UserRole.WAREHOUSE, UserRole.CUSTOMER])
def test_non_admin_roles_are_forbidden(client, make_user, method, path, body, role):
    user = make_user(role)

    response = client.request(method, path, headers=auth_headers(user), json=body)

    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"


@pytest.mark.parametrize(("method", "path", "body"), ADMIN_ONLY_ENDPOINTS)
def test_admin_endpoints_require_token(client, method, path, body):
    response = client.request(method, path, json=body)

    assert response.status_code == 401
