"""Tüm API uçlarında kimlik doğrulama ve rol denetimi (OWASP A01).

Uç noktalar app.routes üzerinden toplanır; yeni eklenen bir uç nokta da otomatik olarak denetlenir.
"""

import re
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.routing import APIRoute, iter_route_contexts

from app.core.config import settings
from app.main import app
from app.models import Order, OrderStatus, UserRole
from tests.conftest import auth_headers

PUBLIC_ROUTES = {("GET", "/health"), ("POST", "/auth/register"), ("POST", "/auth/login")}
# Giriş yapmış her kullanıcının erişebildiği uçlar (rol kısıtı yok)
ANY_ROLE_ROUTES = {
    ("GET", "/auth/me"),
    ("PATCH", "/auth/me"),
    ("POST", "/auth/me/password"),
    ("POST", "/auth/logout"),
}
STAFF_PREFIXES = ("/users", "/products", "/stock", "/orders", "/customers", "/dashboard", "/reports", "/categories")
ADMIN_ONLY_PREFIXES = ("/users", "/customers", "/dashboard", "/reports")


def _allowed_roles(route: APIRoute) -> frozenset[UserRole] | None:
    """Uç noktanın bağımlılık ağacındaki require_roles kısıtını döndürür; yoksa None."""
    stack = list(route.dependant.dependencies)
    while stack:
        dependant = stack.pop()
        roles = getattr(dependant.call, "allowed_roles", None)
        if roles is not None:
            return roles
        stack.extend(dependant.dependencies)
    return None


def _endpoints() -> list[tuple[str, str, frozenset[UserRole] | None]]:
    endpoints = []
    # Dahil edilen router'lar app.routes içinde gruplanır; iter_route_contexts tam yollarıyla açar.
    for context in iter_route_contexts(app.routes):
        route = context.original_route
        # OpenAPI/Swagger/ReDoc yolları APIRoute değildir ve herkese açıktır.
        if not isinstance(route, APIRoute):
            continue
        path = re.sub(r"\{[^}]+\}", "1", context.path)
        for method in sorted(context.methods - {"HEAD"}):
            endpoints.append((method, path, _allowed_roles(route)))
    return endpoints


ENDPOINTS = _endpoints()
PROTECTED = [(m, p, roles) for m, p, roles in ENDPOINTS if (m, p) not in PUBLIC_ROUTES]


def _ids(endpoints):
    return [f"{m} {p}" for m, p, _ in endpoints]


def test_route_inventory_is_complete():
    keys = {(m, p) for m, p, _ in ENDPOINTS}
    assert PUBLIC_ROUTES <= keys
    # Rol kısıtı olmayan korumalı uçlar yalnızca profil uçlarıdır; yeni bir uç rol belirtmeyi unutursa test kırılır.
    assert {(m, p) for m, p, roles in PROTECTED if roles is None} == ANY_ROLE_ROUTES
    assert len(PROTECTED) > 40


@pytest.mark.parametrize(("method", "path", "roles"), PROTECTED, ids=_ids(PROTECTED))
def test_protected_routes_require_token(client, method, path, roles):
    response = client.request(method, path)

    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHORIZED"
    assert response.headers["www-authenticate"] == "Bearer"


STAFF_ROUTES = [e for e in PROTECTED if e[1].startswith(STAFF_PREFIXES)]


@pytest.mark.parametrize(("method", "path", "roles"), STAFF_ROUTES, ids=_ids(STAFF_ROUTES))
def test_customer_is_forbidden_on_staff_routes(client, customer, method, path, roles):
    response = client.request(method, path, headers=auth_headers(customer))

    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"


ADMIN_ONLY_ROUTES = [e for e in PROTECTED if e[2] == frozenset({UserRole.ADMIN})]


def test_admin_only_prefixes_are_restricted_to_admin():
    for method, path, roles in PROTECTED:
        if path.startswith(ADMIN_ONLY_PREFIXES):
            assert roles == frozenset({UserRole.ADMIN}), f"{method} {path}"


@pytest.mark.parametrize(("method", "path", "roles"), ADMIN_ONLY_ROUTES, ids=_ids(ADMIN_ONLY_ROUTES))
def test_warehouse_is_forbidden_on_admin_routes(client, warehouse, method, path, roles):
    response = client.request(method, path, headers=auth_headers(warehouse))

    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"


CUSTOMER_ONLY_ROUTES = [e for e in PROTECTED if e[2] == frozenset({UserRole.CUSTOMER})]


@pytest.mark.parametrize(("method", "path", "roles"), CUSTOMER_ONLY_ROUTES, ids=_ids(CUSTOMER_ONLY_ROUTES))
def test_staff_is_forbidden_on_shop_routes(client, admin, warehouse, method, path, roles):
    for user in (admin, warehouse):
        response = client.request(method, path, headers=auth_headers(user))
        assert response.status_code == 403


# --- Token doğrulaması ---


def _token(**overrides):
    now = datetime.now(UTC)
    payload = {"sub": "1", "role": "admin", "ver": 0, "iat": now, "exp": now + timedelta(minutes=5), **overrides}
    payload = {k: v for k, v in payload.items() if v is not None}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def _forged_tokens(user_id: int) -> dict[str, str]:
    sub = str(user_id)
    return {
        "garbage": "not-a-jwt",
        "wrong_secret": jwt.encode({"sub": sub, "exp": datetime.now(UTC) + timedelta(minutes=5)}, "x" * 32),
        "expired": _token(sub=sub, exp=datetime.now(UTC) - timedelta(minutes=1)),
        "no_exp": _token(sub=sub, exp=None),
        "alg_none": jwt.encode({"sub": sub}, key=None, algorithm="none"),
        "unknown_user": _token(sub="999999999"),
        # Bu özellikten önce verilen token'larda sürüm yoktur.
        "no_version": _token(sub=sub, ver=None),
        "old_version": _token(sub=sub, ver=-1),
    }


@pytest.mark.parametrize(
    "kind", ["garbage", "wrong_secret", "expired", "no_exp", "alg_none", "unknown_user", "no_version", "old_version"]
)
def test_invalid_tokens_are_rejected(client, admin, kind):
    token = _forged_tokens(admin.id)[kind]

    response = client.get("/users", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


def test_valid_admin_token_is_accepted(client, admin):
    assert client.get("/users", headers=auth_headers(admin)).status_code == 200


# --- IDOR: müşteri başka müşterinin siparişine erişemez ---


def _place_order(client, user, product):
    payload = {
        "items": [{"product_id": product.id, "quantity": 1, "expected_price": str(product.sale_price)}],
        "payment_method": "credit_card",
        "shipping_address": "Bağdat Cad. No: 5, İstanbul",
    }
    response = client.post("/me/orders", headers=auth_headers(user), json=payload)
    assert response.status_code == 201
    return response.json()


def test_customer_cannot_cancel_another_customers_order(client, db, make_user, customer, make_product):
    product = make_product(stock=100)
    theirs = _place_order(client, make_user(), product)

    response = client.post(f"/me/orders/{theirs['id']}/cancel", headers=auth_headers(customer))

    assert response.status_code == 404
    assert db.get(Order, theirs["id"]).status == OrderStatus.PENDING


def test_customer_cannot_read_another_customers_order(client, make_user, customer, make_product):
    product = make_product(stock=100)
    theirs = _place_order(client, make_user(), product)

    detail = client.get(f"/me/orders/{theirs['id']}", headers=auth_headers(customer))
    listed = client.get("/me/orders", headers=auth_headers(customer), params={"search": theirs["order_code"]})

    assert detail.status_code == 404
    assert listed.json()["total"] == 0
