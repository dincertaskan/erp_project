"""Uçtan uca senaryo testleri: her test bir kullanıcının işini baştan sona gerçek HTTP çağrılarıyla yürütür."""

from app.core import clock
from app.models import UserRole
from tests.conftest import TEST_PASSWORD, auth_headers


def login(client, email: str, password: str = TEST_PASSWORD) -> dict[str, str]:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def critical_count(client, headers) -> int:
    return client.get("/stock/critical/count", headers=headers).json()["count"]


def stock_of(client, headers, product_id: int) -> int:
    return client.get(f"/products/{product_id}", headers=headers).json()["stock"]


def sales_report_today(client, headers) -> dict:
    # Rapor tarihleri İstanbul saatine göredir.
    today = clock.now().date().isoformat()
    response = client.get("/reports/sales", headers=headers, params={"from": today, "to": today})
    assert response.status_code == 200, response.text
    return response.json()["totals"]


def test_warehouse_staff_journey(client, admin, make_user, make_category, make_product):
    """Senaryo 1 (depo personeli): giriş yapar, ürünü SKU ile bulur, stok girişi ve çıkışı yapar,
    hareket geçmişini ve kritik stok listesini kontrol eder, hazırlanan siparişi kargoya verir."""
    staff = make_user(UserRole.WAREHOUSE, email="depo.senaryo@example.com")
    category = make_category("Senaryo Kırtasiye")
    notebook = make_product(category, sku="SNR-DFT-01", name="Kareli Defter", stock=8, min_stock=5)
    pen = make_product(category, sku="SNR-KLM-01", name="Tükenmez Kalem", stock=20, min_stock=2)
    headers = login(client, staff.email)
    critical_before = critical_count(client, headers)

    # Ürün SKU ile aranır.
    found = client.get("/products", headers=headers, params={"search": "snr-dft"}).json()
    assert [p["id"] for p in found["items"]] == [notebook.id]
    assert "cost_price" not in found["items"][0]  # depo personeli maliyeti görmez

    # Stok girişi: 8 + 4 = 12.
    response = client.post(
        "/stock/movements",
        headers=headers,
        json={"product_id": notebook.id, "movement_type": "in", "quantity": 4, "description": "Tedarikçi teslimatı"},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert (body["movement"]["previous_stock"], body["movement"]["new_stock"]) == (8, 12)
    assert body["movement"]["user"]["id"] == staff.id
    assert body["product"] == {"id": notebook.id, "stock": 12, "stock_status": "sufficient"}

    # Açıklamasız stok çıkışı reddedilir ve stok değişmez.
    response = client.post(
        "/stock/movements",
        headers=headers,
        json={"product_id": notebook.id, "movement_type": "out", "quantity": 10},
    )
    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"
    assert stock_of(client, headers, notebook.id) == 12

    # Mevcuttan fazla çıkış 409 döner.
    response = client.post(
        "/stock/movements",
        headers=headers,
        json={"product_id": notebook.id, "movement_type": "out", "quantity": 13, "description": "Fire"},
    )
    assert response.status_code == 409
    assert response.json()["code"] == "INSUFFICIENT_STOCK"

    # Gerekçeli çıkış stoğu minimumun altına düşürür: 12 - 10 = 2 < 5.
    response = client.post(
        "/stock/movements",
        headers=headers,
        json={"product_id": notebook.id, "movement_type": "out", "quantity": 10, "description": "Hasarlı ürün"},
    )
    assert response.status_code == 201, response.text
    assert response.json()["product"] == {"id": notebook.id, "stock": 2, "stock_status": "critical"}

    # Hareket geçmişi en yeni önce, iki kayıt.
    history = client.get("/stock/movements", headers=headers, params={"product_id": notebook.id}).json()
    assert history["total"] == 2
    assert [(m["movement_type"], m["quantity"], m["new_stock"]) for m in history["items"]] == [
        ("out", 10, 2),
        ("in", 4, 12),
    ]
    assert history["items"][0]["description"] == "Hasarlı ürün"
    outgoing = client.get("/stock/movements", headers=headers, params={"product_id": notebook.id, "type": "out"})
    assert outgoing.json()["total"] == 1

    # Kritik stok listesi ve sayacı güncellenir.
    assert critical_count(client, headers) == critical_before + 1
    critical = client.get("/stock/critical", headers=headers, params={"category_id": category.id}).json()
    assert [(p["id"], p["stock"], p["shortage"]) for p in critical["items"]] == [(notebook.id, 2, 3)]

    # Yöneticinin onayladığı sipariş depo personelinin listesine düşer ve kargoya verilir.
    order = client.post(
        "/orders",
        headers=auth_headers(admin),
        json={
            "customer_id": make_user(UserRole.CUSTOMER).customer.id,
            "items": [{"product_id": pen.id, "quantity": 3}],
            "payment_method": "bank_transfer",
            "shipping_address": "Atatürk Cad. No: 1, Ankara",
        },
    ).json()
    assert client.get(f"/orders/{order['id']}", headers=headers).status_code == 403  # onay bekleyen görünmez
    assert client.post(f"/orders/{order['id']}/approve", headers=auth_headers(admin)).status_code == 200

    listed = client.get("/orders", headers=headers, params={"status": "preparing"}).json()
    assert order["id"] in [o["id"] for o in listed["items"]]
    detail = client.get(f"/orders/{order['id']}", headers=headers).json()
    assert detail["allowed_actions"] == ["ship"]
    assert client.post(f"/orders/{order['id']}/approve", headers=headers).status_code == 403

    response = client.post(f"/orders/{order['id']}/ship", headers=headers)
    assert response.status_code == 200, response.text
    shipped = response.json()
    assert shipped["status"] == "shipped"
    assert shipped["shipped_at"] is not None
    assert shipped["history"][-1]["changed_by"]["id"] == staff.id
    assert shipped["allowed_actions"] == []
    assert stock_of(client, headers, pen.id) == 17  # stok onayda düşüldü, kargoda değişmez

    # Aynı sipariş ikinci kez kargolanamaz.
    response = client.post(f"/orders/{order['id']}/ship", headers=headers)
    assert response.status_code == 409
    assert response.json()["code"] == "INVALID_TRANSITION"


def test_customer_journey(client, admin, make_category, make_product):
    """Senaryo 2 (müşteri): kayıt olur, giriş yapar, kataloğu gezer, sepeti doğrular, sipariş verir ve iptal eder;
    sepete eklendikten sonra fiyatı değişen ürünle sipariş verilemez."""
    category = make_category("Senaryo Ev Gereçleri")
    kettle = make_product(category, sku="SNR-KTL-01", name="Su Isıtıcı", stock=10, sale_price="450.00")
    make_product(category, sku="SNR-TST-01", name="Ekmek Kızartma", stock=4, sale_price="650.00")
    make_product(category, sku="SNR-ESK-01", name="Eski Model", sale_price="5.00", is_active=False)
    make_product(make_category(), sku="SNR-PHL-01", name="Pahalı Ürün", sale_price="9999.00")

    # Kayıt ve giriş.
    response = client.post(
        "/auth/register",
        json={"full_name": "Ayşe Yılmaz", "email": "Ayse.Senaryo@example.com", "password": "Guvenli123"},
    )
    assert response.status_code == 201, response.text
    assert response.json()["role"] == "customer"
    assert response.json()["customer"] is not None
    headers = login(client, "ayse.senaryo@example.com", "Guvenli123")
    me = client.get("/auth/me", headers=headers).json()
    assert me["email"] == "ayse.senaryo@example.com"

    # Müşteri panel uçlarına erişemez.
    assert client.get("/products", headers=headers).status_code == 403

    # Katalog: kategoriler, ürün listesi ve ürün detayı.
    categories = client.get("/catalog/categories", headers=headers).json()
    assert {"id": category.id, "name": category.name, "product_count": 2}.items() <= next(
        c for c in categories if c["id"] == category.id
    ).items()
    products = client.get("/catalog/products", headers=headers, params={"category_id": category.id}).json()
    assert products["total"] == 2
    assert all("cost_price" not in p for p in products["items"])
    # Fiyat aralığı yalnızca bu kategorideki satıştaki ürünlerden hesaplanır.
    assert (products["min_price"], products["max_price"]) == ("450.00", "650.00")
    detail = client.get(f"/catalog/products/{kettle.id}", headers=headers).json()
    assert (detail["sale_price"], detail["availability"], detail["available_qty"]) == ("450.00", "in_stock", 10)
    assert [r["sku"] for r in detail["related"]] == ["SNR-TST-01"]

    # Sepet doğrulanır; sorun yok.
    cart = [{"product_id": kettle.id, "quantity": 2, "expected_price": detail["sale_price"]}]
    validation = client.post("/me/cart/validate", headers=headers, json={"items": cart}).json()
    assert validation["issues"] == []

    # Sipariş verilir.
    checkout = {
        "items": cart,
        "payment_method": "credit_card",
        "shipping_address": "Bağdat Cad. No: 5, Kadıköy, İstanbul",
    }
    response = client.post("/me/orders", headers=headers, json=checkout)
    assert response.status_code == 201, response.text
    order = response.json()
    assert (order["status"], order["total_amount"], order["can_cancel"]) == ("pending", "900.00", True)
    assert order["items"][0]["unit_price"] == "450.00"

    # Sipariş müşterinin listesinde görünür; stok onaya kadar düşmez.
    mine = client.get("/me/orders", headers=headers).json()
    assert [o["order_code"] for o in mine["items"]] == [order["order_code"]]
    assert stock_of(client, auth_headers(admin), kettle.id) == 10

    # Müşteri onay bekleyen siparişini iptal eder; ikinci iptal reddedilir.
    response = client.post(f"/me/orders/{order['id']}/cancel", headers=headers)
    assert response.status_code == 200, response.text
    cancelled = response.json()
    assert (cancelled["status"], cancelled["can_cancel"]) == ("cancelled", False)
    assert [step["status"] for step in cancelled["timeline"]] == ["pending", "cancelled"]
    response = client.post(f"/me/orders/{order['id']}/cancel", headers=headers)
    assert response.status_code == 409
    assert response.json()["code"] == "CANNOT_CANCEL"
    cancelled_list = client.get("/me/orders", headers=headers, params={"status_group": "cancelled"}).json()
    assert [o["id"] for o in cancelled_list["items"]] == [order["id"]]

    # Sepet ile ödeme arasında yönetici fiyatı günceller.
    admin_view = client.get(f"/products/{kettle.id}", headers=auth_headers(admin)).json()
    update = {
        key: admin_view[key]
        for key in ("sku", "name", "sale_price", "cost_price", "min_stock", "description", "image_url", "is_active")
    }
    response = client.put(
        f"/products/{kettle.id}",
        headers=auth_headers(admin),
        json={**update, "category_id": category.id, "sale_price": "499.00"},
    )
    assert response.status_code == 200, response.text

    validation = client.post("/me/cart/validate", headers=headers, json={"items": cart}).json()
    assert [(i["issue"], i["old_price"], i["new_price"]) for i in validation["issues"]] == [
        ("price_changed", "450.00", "499.00")
    ]

    # Eski fiyatla sipariş engellenir ve yeni sipariş oluşmaz.
    response = client.post("/me/orders", headers=headers, json=checkout)
    assert response.status_code == 409
    body = response.json()
    assert body["code"] == "CART_CHANGED"
    assert [(d["product_id"], d["issue"]) for d in body["details"]] == [(kettle.id, "price_changed")]
    assert client.get("/me/orders", headers=headers).json()["total"] == 1

    # Güncel fiyatla sipariş verilebilir.
    checkout["items"] = [{**cart[0], "expected_price": "499.00"}]
    response = client.post("/me/orders", headers=headers, json=checkout)
    assert response.status_code == 201, response.text
    assert response.json()["total_amount"] == "998.00"


def test_admin_order_lifecycle(client, admin, warehouse, customer):
    """Senaryo 3 (yönetici): kategori ve ürün oluşturur, stoğu yetmeyen siparişi girer, onay stok gelene kadar
    reddedilir; sipariş onaylanır, kargolanır, tamamlanır ve panel, rapor ve müşteri istatistikleri güncellenir.
    Hazırlanan bir siparişin iptali stoğu geri ekler."""
    headers = login(client, admin.email)
    customer_id = customer.customer.id
    summary_before = client.get("/dashboard/summary", headers=headers).json()
    report_before = sales_report_today(client, headers)

    # Kategori ve ürün oluşturulur.
    response = client.post("/categories", headers=headers, json={"name": "Senaryo Elektronik", "color": "#10b981"})
    assert response.status_code == 201, response.text
    category = response.json()
    response = client.post(
        "/products",
        headers=headers,
        json={
            "name": "Kablosuz Klavye",
            "category_id": category["id"],
            "sku": "snr-klv-01",
            "sale_price": "250.00",
            "cost_price": "150.00",
            "min_stock": 2,
            "initial_stock": 3,
        },
    )
    assert response.status_code == 201, response.text
    product = response.json()
    assert (product["sku"], product["stock"]) == ("SNR-KLV-01", 3)

    # Stoktan fazla miktarla sipariş oluşturulur; eksik bildirilir ama sipariş engellenmez.
    response = client.post(
        "/orders",
        headers=headers,
        json={
            "customer_id": customer_id,
            "items": [{"product_id": product["id"], "quantity": 5}],
            "payment_method": "cash_on_delivery",
            "shipping_address": "Cumhuriyet Mah. No: 7, İzmir",
        },
    )
    assert response.status_code == 201, response.text
    order = response.json()
    assert (order["status"], order["total_amount"]) == ("pending", "1250.00")
    assert [(s["product_id"], s["requested"], s["available"]) for s in order["shortages"]] == [(product["id"], 5, 3)]
    pending_now = client.get("/dashboard/summary", headers=headers).json()["pending_orders"]
    assert pending_now == summary_before["pending_orders"] + 1

    # Onay yetersiz stok nedeniyle reddedilir ve hiçbir şey değişmez.
    response = client.post(f"/orders/{order['id']}/approve", headers=headers)
    assert response.status_code == 409
    body = response.json()
    assert body["code"] == "INSUFFICIENT_STOCK"
    assert [(d["product_id"], d["requested"], d["available"]) for d in body["details"]] == [(product["id"], 5, 3)]
    unchanged = client.get(f"/orders/{order['id']}", headers=headers).json()
    assert (unchanged["status"], unchanged["approved_at"], unchanged["movements"]) == ("pending", None, [])
    assert stock_of(client, headers, product["id"]) == 3

    # Stok girişi yapılır, onay başarılı olur ve stok düşer.
    response = client.post(
        "/stock/movements",
        headers=headers,
        json={"product_id": product["id"], "movement_type": "in", "quantity": 7},
    )
    assert response.status_code == 201, response.text
    response = client.post(f"/orders/{order['id']}/approve", headers=headers)
    assert response.status_code == 200, response.text
    approved = response.json()
    assert (approved["status"], approved["shortages"]) == ("preparing", [])
    assert [(m["movement_type"], m["quantity"], m["new_stock"]) for m in approved["movements"]] == [("order_out", 5, 5)]
    assert stock_of(client, headers, product["id"]) == 5

    # Depo personeli kargolar, yönetici tamamlar.
    response = client.post(f"/orders/{order['id']}/ship", headers=login(client, warehouse.email))
    assert response.status_code == 200, response.text
    response = client.post(f"/orders/{order['id']}/complete", headers=headers)
    assert response.status_code == 200, response.text
    completed = response.json()
    assert completed["status"] == "completed"
    assert [h["to_status"] for h in completed["history"]] == ["pending", "preparing", "shipped", "completed"]

    # Panel, satış raporu ve müşteri istatistikleri ciroyu yansıtır.
    summary = client.get("/dashboard/summary", headers=headers).json()
    assert float(summary["today_sales"]) == float(summary_before["today_sales"]) + 1250
    assert summary["today_order_count"] == summary_before["today_order_count"] + 1
    assert float(summary["month_sales"]) == float(summary_before["month_sales"]) + 1250
    assert summary["pending_orders"] == summary_before["pending_orders"]
    report = sales_report_today(client, headers)
    assert report["order_count"] == report_before["order_count"] + 1
    assert report["quantity"] == report_before["quantity"] + 5
    assert float(report["revenue"]) == float(report_before["revenue"]) + 1250
    assert float(report["cost"]) == float(report_before["cost"]) + 750
    assert float(report["gross_profit"]) == float(report_before["gross_profit"]) + 500
    stats = client.get(f"/customers/{customer_id}", headers=headers).json()["stats"]
    assert (stats["order_count"], stats["revenue_order_count"], stats["total_spent"]) == (1, 1, "1250.00")
    assert stats["last_order_at"] is not None

    # Hazırlanan ikinci sipariş iptal edilince stok geri eklenir ve ciroya girmez.
    second = client.post(
        "/orders",
        headers=headers,
        json={
            "customer_id": customer_id,
            "items": [{"product_id": product["id"], "quantity": 2}],
            "payment_method": "credit_card",
        },
    ).json()
    assert client.post(f"/orders/{second['id']}/approve", headers=headers).status_code == 200
    assert stock_of(client, headers, product["id"]) == 3
    response = client.post(f"/orders/{second['id']}/cancel", headers=headers)
    assert response.status_code == 200, response.text
    cancelled = response.json()
    assert cancelled["status"] == "cancelled"
    assert [(m["movement_type"], m["quantity"]) for m in cancelled["movements"]] == [
        ("order_out", 2),
        ("cancel_return", 2),
    ]
    assert stock_of(client, headers, product["id"]) == 5

    assert float(sales_report_today(client, headers)["revenue"]) == float(report_before["revenue"]) + 1250
    stats = client.get(f"/customers/{customer_id}", headers=headers).json()["stats"]
    assert (stats["order_count"], stats["revenue_order_count"], stats["total_spent"]) == (2, 1, "1250.00")
