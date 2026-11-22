import pytest

from tests.conftest import auth_headers


def test_staff_can_list_categories_with_active_product_counts(client, warehouse, make_category, make_product):
    category = make_category("Kırtasiye")
    make_product(category)
    make_product(category)
    make_product(category, is_active=False)

    response = client.get("/categories", headers=auth_headers(warehouse), params={"search": "kırtas"})

    assert response.status_code == 200
    [item] = response.json()
    assert item["name"] == "Kırtasiye"
    assert item["product_count"] == 2


def test_customers_cannot_list_categories(client, customer):
    response = client.get("/categories", headers=auth_headers(customer))

    assert response.status_code == 403


def test_filter_by_status(client, admin, make_category):
    make_category("Aktif Kategori")
    make_category("Pasif Kategori", is_active=False)

    response = client.get("/categories", headers=auth_headers(admin), params={"is_active": False})

    assert [c["name"] for c in response.json()] == ["Pasif Kategori"]


def test_admin_creates_category_with_normalized_color(client, admin):
    response = client.post("/categories", headers=auth_headers(admin), json={"name": "  Bahçe  ", "color": "#10b981"})

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Bahçe"
    assert body["color"] == "#10B981"
    assert body["is_active"] is True
    assert body["product_count"] == 0


def test_duplicate_names_are_rejected_case_insensitively(client, admin, make_category):
    make_category("Elektronik")

    response = client.post("/categories", headers=auth_headers(admin), json={"name": "elektronik"})

    assert response.status_code == 409
    assert response.json()["details"] == [{"field": "name", "message": "Bu isimde bir kategori zaten var."}]


def test_invalid_color_is_rejected(client, admin):
    response = client.post("/categories", headers=auth_headers(admin), json={"name": "Renkli", "color": "mavi"})

    assert response.status_code == 422
    assert response.json()["details"][0] == {"field": "color", "message": "Renk #RRGGBB biçiminde olmalıdır."}


def test_admin_updates_category_and_keeps_its_own_name(client, admin, make_category):
    category = make_category("Ofis")

    response = client.put(
        f"/categories/{category.id}",
        headers=auth_headers(admin),
        json={"name": "Ofis", "color": "#EC4899", "is_active": True},
    )

    assert response.status_code == 200
    assert response.json()["color"] == "#EC4899"


def test_rename_to_an_existing_name_conflicts(client, admin, make_category):
    make_category("Elektronik")
    other = make_category("Ofis")

    response = client.put(f"/categories/{other.id}", headers=auth_headers(admin), json={"name": "Elektronik"})

    assert response.status_code == 409


def test_deactivating_keeps_products(client, admin, make_category, make_product):
    category = make_category()
    make_product(category)

    response = client.patch(f"/categories/{category.id}/status", headers=auth_headers(admin), json={"is_active": False})

    assert response.status_code == 200
    assert response.json()["is_active"] is False
    assert response.json()["product_count"] == 1


def test_unknown_category_returns_404(client, admin):
    response = client.patch("/categories/999999/status", headers=auth_headers(admin), json={"is_active": False})

    assert response.status_code == 404


@pytest.mark.parametrize(
    ("method", "path"),
    [("post", "/categories"), ("put", "/categories/1"), ("patch", "/categories/1/status")],
)
def test_warehouse_cannot_change_categories(client, warehouse, method, path):
    response = client.request(method, path, headers=auth_headers(warehouse), json={"name": "X", "is_active": False})

    assert response.status_code == 403
