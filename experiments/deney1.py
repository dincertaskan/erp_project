"""Deney 1: eşzamanlı sipariş onayında stok kilidi stratejilerinin karşılaştırılması.

Her koşuda API üzerinden stoğu K olan bir ürün ve bu üründen 1'er adetlik N "Onay Bekliyor" sipariş
oluşturulur; N onay isteği aynı anda gönderilir. Ölçülenler: onaylanan sipariş sayısı, fazla satış
(onaylanan - K), son stok, kayıp güncelleme (stoktan düşmesi gereken ile düşen arasındaki fark),
başarısız istek oranı, ortalama ve p95 yanıt süresi. Sonuçlar CSV'ye eklenir.

Sunucu stratejisi STOCK_STRATEGY ortam değişkeniyle seçilir; --restart verilirse betik backend
konteynerini her strateji için yeniden başlatır.

Örnek:
    python deney1.py --strategies none,pessimistic,optimistic --concurrency 10,50,100 --repetitions 30 --restart
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import os
import statistics
import subprocess
import time
import uuid
from datetime import UTC, datetime
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent
FIELDS = [
    "timestamp",
    "strategy",
    "workers",
    "concurrency",
    "initial_stock",
    "repetition",
    "approved",
    "insufficient",
    "other_errors",
    "final_stock",
    "oversell",
    "lost_updates",
    "mean_ms",
    "p95_ms",
    "failure_rate",
]


def p95(values: list[float]) -> float:
    ordered = sorted(values)
    return ordered[max(0, round(0.95 * len(ordered)) - 1)] if ordered else 0.0


class Api:
    def __init__(self, base_url: str, email: str, password: str):
        self.base_url = base_url.rstrip("/")
        self.email, self.password = email, password
        self.headers: dict[str, str] = {}

    def login(self) -> None:
        response = httpx.post(f"{self.base_url}/auth/login", json={"email": self.email, "password": self.password})
        response.raise_for_status()
        self.headers = {"Authorization": f"Bearer {response.json()['access_token']}"}

    def request(self, method: str, path: str, **kwargs) -> dict:
        response = httpx.request(method, f"{self.base_url}{path}", headers=self.headers, timeout=30, **kwargs)
        response.raise_for_status()
        return response.json()

    def category_id(self) -> int:
        for category in self.request("GET", "/categories", params={"search": "Deney 1"}):
            if category["name"] == "Deney 1":
                return category["id"]
        return self.request("POST", "/categories", json={"name": "Deney 1", "color": "#4B5563"})["id"]

    def customer_id(self) -> int:
        customers = self.request("GET", "/customers", params={"is_active": True, "page_size": 1})["items"]
        if not customers:
            raise SystemExit("Deney için en az bir aktif müşteri gerekli (seed çalıştırın).")
        return customers[0]["id"]

    def prepare(self, category_id: int, customer_id: int, stock: int, orders: int) -> tuple[int, list[int]]:
        product = self.request(
            "POST",
            "/products",
            json={
                "name": f"Deney ürünü {uuid.uuid4().hex[:8]}",
                "category_id": category_id,
                "sale_price": "10.00",
                "cost_price": "5.00",
                "initial_stock": stock,
                "min_stock": 0,
            },
        )
        order_ids = [
            self.request(
                "POST",
                "/orders",
                json={
                    "customer_id": customer_id,
                    "items": [{"product_id": product["id"], "quantity": 1}],
                    "payment_method": "credit_card",
                    "shipping_address": "Deney adresi",
                },
            )["id"]
            for _ in range(orders)
        ]
        return product["id"], order_ids

    async def approve_all(self, order_ids: list[int]) -> list[tuple[int, str, float]]:
        """Tüm onay isteklerini aynı anda gönderir; (durum kodu, hata kodu, süre ms) döner."""
        limits = httpx.Limits(max_connections=len(order_ids), max_keepalive_connections=len(order_ids))
        async with httpx.AsyncClient(base_url=self.base_url, headers=self.headers, timeout=60, limits=limits) as client:
            start = asyncio.Event()

            async def approve(order_id: int) -> tuple[int, str, float]:
                await start.wait()
                began = time.perf_counter()
                response = await client.post(f"/orders/{order_id}/approve")
                elapsed = (time.perf_counter() - began) * 1000
                code = response.json().get("code", "") if response.status_code >= 400 else ""
                return response.status_code, code, elapsed

            tasks = [asyncio.create_task(approve(order_id)) for order_id in order_ids]
            await asyncio.sleep(0.2)  # tüm bağlantılar hazır olsun, sonra hepsi birlikte
            start.set()
            return await asyncio.gather(*tasks)


def restart_backend(strategy: str, workers: int, base_url: str) -> None:
    env = {**os.environ, "STOCK_STRATEGY": strategy, "UVICORN_WORKERS": str(workers)}
    subprocess.run(["docker", "compose", "up", "-d", "backend"], check=True, env=env, cwd=ROOT.parent)
    for _ in range(60):
        try:
            if httpx.get(f"{base_url}/health", timeout=2).status_code == 200:
                return
        except httpx.HTTPError:
            pass
        time.sleep(1)
    raise SystemExit("Backend 60 saniyede hazır olmadı.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--base-url", default=os.environ.get("ERP_API", "http://localhost:8000"))
    parser.add_argument("--email", default=os.environ.get("ERP_EMAIL", "yonetici@example.com"))
    parser.add_argument("--password", default=os.environ.get("ERP_PASSWORD"), help="ya da ERP_PASSWORD")
    parser.add_argument("--strategies", default="pessimistic", help="virgülle: none,pessimistic,optimistic")
    parser.add_argument("--concurrency", default="10", help="virgülle eşzamanlı istek sayıları")
    parser.add_argument("--stock", type=float, default=0.5, help="başlangıç stoku: tam sayı ya da N'ye oran (0.5)")
    parser.add_argument("--repetitions", type=int, default=1)
    parser.add_argument("--workers", type=int, default=4, help="--restart ile uvicorn worker sayısı")
    parser.add_argument("--restart", action="store_true", help="her strateji için backend'i yeniden başlat")
    parser.add_argument("--out", type=Path, default=ROOT / "results" / "deney1.csv")
    args = parser.parse_args()
    if not args.password:
        raise SystemExit("Yönetici şifresini --password ya da ERP_PASSWORD ile verin.")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    new_file = not args.out.exists()
    with args.out.open("a", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        if new_file:
            writer.writeheader()
        try:
            run_all(args, writer, handle)
        finally:
            if args.restart:
                # Sunucu deney stratejisinde kalmasın.
                restart_backend("pessimistic", 1, args.base_url)


def run_all(args, writer, handle) -> None:
    for strategy in args.strategies.split(","):
        if args.restart:
            restart_backend(strategy, args.workers, args.base_url)
        api = Api(args.base_url, args.email, args.password)
        api.login()
        category_id, customer_id = api.category_id(), api.customer_id()
        for concurrency in (int(c) for c in args.concurrency.split(",")):
            stock = int(args.stock) if args.stock >= 1 else max(1, int(concurrency * args.stock))
            for repetition in range(1, args.repetitions + 1):
                product_id, order_ids = api.prepare(category_id, customer_id, stock, concurrency)
                results = asyncio.run(api.approve_all(order_ids))
                final_stock = api.request("GET", f"/products/{product_id}")["stock"]
                approved = sum(1 for status, _, _ in results if status == 200)
                insufficient = sum(1 for _, code, _ in results if code == "INSUFFICIENT_STOCK")
                latencies = [elapsed for _, _, elapsed in results]
                row = {
                    "timestamp": datetime.now(UTC).isoformat(timespec="seconds"),
                    "strategy": strategy,
                    "workers": args.workers if args.restart else "",
                    "concurrency": concurrency,
                    "initial_stock": stock,
                    "repetition": repetition,
                    "approved": approved,
                    "insufficient": insufficient,
                    "other_errors": len(results) - approved - insufficient,
                    "final_stock": final_stock,
                    "oversell": max(0, approved - stock),
                    # Onaylanan satışların stoğa yansımayan kısmı (kilitsiz modda kayıp güncelleme)
                    "lost_updates": final_stock - (stock - approved),
                    "mean_ms": round(statistics.fmean(latencies), 2),
                    "p95_ms": round(p95(latencies), 2),
                    "failure_rate": round((len(results) - approved - insufficient) / len(results), 4),
                }
                writer.writerow(row)
                handle.flush()
                print(
                    f"{strategy:<12} N={concurrency:<4} #{repetition:<3} onay={approved:<4} "
                    f"fazla={row['oversell']:<4} stok={final_stock:<4} p95={row['p95_ms']} ms"
                )


if __name__ == "__main__":
    main()
