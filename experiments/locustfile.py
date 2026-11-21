"""Genel yük testi senaryosu (Locust).

Yönetici panelde gezinir (dashboard, sipariş ve ürün listeleri); depo personeli stok listesi ve kritik
stok sayfalarına bakar. Deney 1'in eşzamanlı onay ölçümü için deney1.py kullanılır.

Kullanım:
    ERP_PASSWORD=... locust -f locustfile.py --host http://localhost:8000 --headless -u 50 -r 10 -t 2m \
        --csv results/yuk
"""

import os

from locust import HttpUser, between, task

PASSWORD = os.environ.get("ERP_PASSWORD", "")


class _Authenticated(HttpUser):
    abstract = True
    email = ""

    def on_start(self) -> None:
        response = self.client.post("/auth/login", json={"email": self.email, "password": PASSWORD}, name="giriş")
        self.client.headers["Authorization"] = f"Bearer {response.json()['access_token']}"


class Yonetici(_Authenticated):
    wait_time = between(1, 3)
    email = os.environ.get("ERP_ADMIN_EMAIL", "yonetici@example.com")

    @task(3)
    def dashboard(self) -> None:
        self.client.get("/dashboard/summary", name="dashboard özet")
        self.client.get("/dashboard/sales-trend", name="dashboard trend")
        self.client.get("/dashboard/top-products", name="dashboard en çok satanlar")

    @task(3)
    def orders(self) -> None:
        self.client.get("/orders", params={"page_size": 20}, name="sipariş listesi")
        self.client.get("/orders", params={"status": "pending", "page_size": 20}, name="sipariş listesi (bekleyen)")

    @task(2)
    def products(self) -> None:
        self.client.get("/products", params={"page_size": 20}, name="ürün listesi")

    @task(1)
    def customers(self) -> None:
        self.client.get("/customers", params={"page_size": 20, "sort": "-total_spent"}, name="müşteri listesi")


class DepoPersoneli(_Authenticated):
    wait_time = between(1, 3)
    email = os.environ.get("ERP_WAREHOUSE_EMAIL", "depo@example.com")

    @task(3)
    def stock(self) -> None:
        self.client.get("/products", params={"page_size": 20, "is_active": True}, name="stok listesi")
        self.client.get("/stock/summary", name="stok özeti")

    @task(1)
    def critical(self) -> None:
        self.client.get("/stock/critical", name="kritik stok")
