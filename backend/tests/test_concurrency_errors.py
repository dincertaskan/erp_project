"""Eşzamanlı isteklerde ön denetimi atlatan yazmalar 500 yerine 409 döner."""

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.core.errors import integrity_conflict
from app.models import Customer
from app.repositories.catalog_repository import CategoryRepository, ProductRepository
from app.repositories.user_repository import UserRepository
from app.services.customer_service import EMAIL_TAKEN as CUSTOMER_EMAIL_TAKEN
from app.services.customer_service import CustomerService
from app.services.product_service import SKU_TAKEN, ProductService
from tests.conftest import auth_headers
from tests.test_products import product_payload


def test_concurrent_product_update_returns_409(client, db, admin, make_product, monkeypatch):
    product = make_product()
    original_get = ProductService._get

    def get_then_bump_version(self, product_id):
        loaded = original_get(self, product_id)
        # Ürün okunduktan sonra başka bir işlem (ör. stok hareketi) sürümü artırır.
        db.execute(text("UPDATE products SET version = version + 1 WHERE id = :id"), {"id": product_id})
        return loaded

    monkeypatch.setattr(ProductService, "_get", get_then_bump_version)

    response = client.patch(f"/products/{product.id}/status", headers=auth_headers(admin), json={"is_active": False})

    assert response.status_code == 409
    assert response.json() == {
        "code": "CONCURRENT_UPDATE",
        "message": "Kayıt başka bir işlem tarafından değiştirildi. Sayfayı yenileyip tekrar deneyin.",
        "details": None,
    }


def test_sku_race_returns_sku_taken(client, admin, make_product, monkeypatch):
    existing = make_product(sku="YRS-0001")
    monkeypatch.setattr(ProductRepository, "get_by_sku", lambda self, sku: None)

    response = client.post(
        "/products",
        headers=auth_headers(admin),
        json=product_payload(existing.category_id, sku="YRS-0001"),
    )

    assert response.status_code == 409
    assert response.json() == {
        "code": "SKU_TAKEN",
        "message": SKU_TAKEN,
        "details": [{"field": "sku", "message": SKU_TAKEN}],
    }


def test_category_name_is_unique_case_insensitively_in_the_database(client, admin, make_category, monkeypatch):
    make_category("Elektronik")
    monkeypatch.setattr(CategoryRepository, "get_by_name", lambda self, name: None)

    response = client.post("/categories", headers=auth_headers(admin), json={"name": "elektronik"})

    assert response.status_code == 409
    assert response.json()["code"] == "CATEGORY_NAME_TAKEN"


def test_register_race_returns_email_taken(client, make_user, monkeypatch):
    make_user(email="Buyuk.Harf@Example.com")
    monkeypatch.setattr(UserRepository, "get_by_email", lambda self, email: None)

    response = client.post(
        "/auth/register",
        json={"full_name": "Yarış", "email": "buyuk.harf@example.com", "password": "Guclu1234"},
    )

    assert response.status_code == 409
    assert response.json()["code"] == "EMAIL_TAKEN"
    assert response.json()["details"][0]["field"] == "email"


def test_customer_email_race_returns_email_taken(client, db, admin, monkeypatch):
    db.add(Customer(full_name="Var Olan", email="Ayni@Example.com"))
    db.flush()
    monkeypatch.setattr(CustomerService, "_ensure_email_free", lambda self, email, current_id=None: None)

    response = client.post(
        "/customers", headers=auth_headers(admin), json={"full_name": "Yeni", "email": "AYNI@example.com"}
    )

    assert response.status_code == 409
    assert response.json()["message"] == CUSTOMER_EMAIL_TAKEN


def test_unknown_integrity_error_maps_to_generic_conflict(db, customer):
    # Hesabı olan bir müşteriye ikinci kart bağlanmaya çalışılır (uq_customers_user_id).
    db.add(Customer(full_name="İkinci", email="ikinci@example.com", user_id=customer.id))

    with pytest.raises(IntegrityError, match="uq_customers_user_id") as caught:
        db.flush()
    db.rollback()

    body = integrity_conflict(caught.value)
    assert body["code"] == "CONFLICT"
    assert body["details"] is None
