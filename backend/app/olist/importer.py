"""Olist açık veri setinin aktarımı (FR-19).

Aktarım uygulamanın sipariş ve stok mantığını atlar; veriler toplu ve doğrudan veritabanına yazılır.
Olist siparişleri için stok hareketi üretilmez (karar 14). Olist'te olmayan alanlar sentetiktir:
ürün adı, satış fiyatı (satırların medyanı), maliyet (satış fiyatının %60'ı), stok ve minimum stok
(sabit tohumlu rastgele), müşteri adı ve e-postası (anonim).
"""

from __future__ import annotations

import csv
import random
import statistics
from collections import defaultdict
from collections.abc import Callable, Iterable, Iterator
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from zoneinfo import ZoneInfo

from sqlalchemy import delete, exists, func, insert, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (
    Category,
    Customer,
    Order,
    OrderItem,
    OrderStatus,
    PaymentMethod,
    Product,
    RecordSource,
)
from app.olist.categories import CATEGORY_TR, PALETTE, UNKNOWN_CATEGORY, category_name

OLIST_TZ = ZoneInfo("America/Sao_Paulo")
COST_RATIO = Decimal("0.60")
RANDOM_SEED = 42
BATCH_SIZE = 5_000
CENT = Decimal("0.01")

STATUS_MAP = {
    "delivered": OrderStatus.COMPLETED,
    "shipped": OrderStatus.SHIPPED,
    "canceled": OrderStatus.CANCELLED,
    "unavailable": OrderStatus.CANCELLED,
    "approved": OrderStatus.PREPARING,
    "processing": OrderStatus.PREPARING,
    "invoiced": OrderStatus.PREPARING,
    "created": OrderStatus.PENDING,
}
PAYMENT_MAP = {
    "credit_card": PaymentMethod.CREDIT_CARD,
    "debit_card": PaymentMethod.CREDIT_CARD,
    "boleto": PaymentMethod.BANK_TRANSFER,
    "voucher": PaymentMethod.BANK_TRANSFER,
}

FILES = {
    "orders": "olist_orders_dataset.csv",
    "items": "olist_order_items_dataset.csv",
    "products": "olist_products_dataset.csv",
    "customers": "olist_customers_dataset.csv",
    "translation": "product_category_name_translation.csv",
    "payments": "olist_order_payments_dataset.csv",
}
REQUIRED = ("orders", "items", "products", "customers")


class OlistError(Exception):
    """Kullanıcıya gösterilecek anlaşılır hata."""


@dataclass
class Summary:
    categories: int = 0
    products: int = 0
    customers: int = 0
    orders: int = 0
    order_items: int = 0
    skipped_orders: int = 0
    deleted: dict[str, int] = field(default_factory=dict)


def _read(path: Path) -> Iterator[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        yield from csv.DictReader(handle)


def _timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.strptime(value, "%Y-%m-%d %H:%M:%S").replace(tzinfo=OLIST_TZ)


def _batched(rows: list[dict], size: int = BATCH_SIZE) -> Iterable[list[dict]]:
    for start in range(0, len(rows), size):
        yield rows[start : start + size]


class OlistImporter:
    def __init__(self, db: Session, data_dir: Path, *, log: Callable[[str], None] = print):
        self.db = db
        self.data_dir = data_dir
        self.log = log

    def _path(self, key: str) -> Path:
        return self.data_dir / FILES[key]

    def check_files(self) -> None:
        missing = [FILES[key] for key in REQUIRED if not self._path(key).exists()]
        if missing:
            raise OlistError(f"{self.data_dir} klasöründe eksik dosyalar: {', '.join(missing)}")

    def already_loaded(self) -> bool:
        return bool(self.db.scalar(select(exists().where(Order.source == RecordSource.OLIST))))

    # --- Silme ---

    def reset(self, summary: Summary) -> None:
        """source='olist' kayıtlarını ve içi boşalan Olist kategorilerini siler."""
        try:
            summary.deleted["orders"] = self.db.execute(
                delete(Order).where(Order.source == RecordSource.OLIST)
            ).rowcount
            summary.deleted["products"] = self.db.execute(
                delete(Product).where(Product.source == RecordSource.OLIST)
            ).rowcount
            summary.deleted["customers"] = self.db.execute(
                delete(Customer).where(Customer.source == RecordSource.OLIST)
            ).rowcount
        except IntegrityError as exc:
            self.db.rollback()
            raise OlistError(
                "Olist ürünleri ya da müşterileri uygulamada oluşturulan siparişlerde kullanılmış; "
                "önce o siparişleri silin ya da veritabanını sıfırlayın."
            ) from exc
        olist_names = set(CATEGORY_TR.values()) | {UNKNOWN_CATEGORY}
        empty = ~exists().where(Product.category_id == Category.id)
        summary.deleted["categories"] = self.db.execute(
            delete(Category).where(Category.name.in_(olist_names), empty)
        ).rowcount
        self.db.commit()

    # --- Yükleme ---

    def load(self, *, sample: int | None = None, scale: int = 1) -> Summary:
        self.check_files()
        summary = Summary()
        english = {}
        if self._path("translation").exists():
            english = {
                row["product_category_name"]: row["product_category_name_english"]
                for row in _read(self._path("translation"))
            }

        orders = sorted(_read(self._path("orders")), key=lambda row: row["order_purchase_timestamp"])
        lines: dict[str, dict[str, list[Decimal]]] = defaultdict(lambda: defaultdict(list))
        for item in _read(self._path("items")):
            lines[item["order_id"]][item["product_id"]].append(Decimal(item["price"]))

        # Kalemi olmayan siparişler (çoğu iptal) atlanır.
        with_items = [row for row in orders if row["order_id"] in lines]
        summary.skipped_orders = len(orders) - len(with_items)
        orders = with_items[:sample] if sample else with_items
        self.log(f"{len(orders)} sipariş okunuyor (kalemsiz {summary.skipped_orders} sipariş atlandı).")

        product_ids = {product_id for row in orders for product_id in lines[row["order_id"]]}
        customer_ids = {row["customer_id"] for row in orders}
        products = {row["product_id"]: row for row in _read(self._path("products")) if row["product_id"] in product_ids}
        customers = {
            row["customer_id"]: row for row in _read(self._path("customers")) if row["customer_id"] in customer_ids
        }
        payments: dict[str, str] = {}
        if self._path("payments").exists():
            best: dict[str, Decimal] = {}
            for row in _read(self._path("payments")):
                value = Decimal(row["payment_value"] or "0")
                if row["order_id"] in lines and value >= best.get(row["order_id"], Decimal("-1")):
                    best[row["order_id"]] = value
                    payments[row["order_id"]] = row["payment_type"]

        category_ids = self._load_categories(products, english, summary)
        product_db_ids = self._load_products(products, lines, orders, category_ids, english, summary)
        customer_db_ids = self._load_customers(customers, summary)
        self._load_orders(orders, lines, customers, customer_db_ids, product_db_ids, payments, scale, summary)
        self.db.commit()
        return summary

    def _load_categories(self, products, english, summary) -> dict[str, int]:
        names = sorted({category_name(row["product_category_name"], english) for row in products.values()})
        existing = dict(self.db.execute(select(Category.name, Category.id).where(Category.name.in_(names))).all())
        new = [name for name in names if name not in existing]
        if new:
            rows = [{"name": name, "color": PALETTE[i % len(PALETTE)], "is_active": True} for i, name in enumerate(new)]
            for name, category_id in self.db.execute(insert(Category).returning(Category.name, Category.id), rows):
                existing[name] = category_id
        summary.categories = len(new)
        self.log(f"Kategoriler: {len(new)} yeni, {len(names) - len(new)} mevcut.")
        return existing

    def _load_products(self, products, lines, orders, category_ids, english, summary) -> dict[str, int]:
        prices: dict[str, list[Decimal]] = defaultdict(list)
        quantities: dict[str, int] = defaultdict(int)
        for row in orders:
            for product_id, item_prices in lines[row["order_id"]].items():
                prices[product_id].extend(item_prices)
                quantities[product_id] += len(item_prices)
        months = max(1, len({row["order_purchase_timestamp"][:7] for row in orders}))

        rng = random.Random(RANDOM_SEED)
        rows = []
        for product_id in sorted(products):
            category = category_name(products[product_id]["product_category_name"], english)
            sale_price = Decimal(statistics.median(prices[product_id])).quantize(CENT, ROUND_HALF_UP)
            # Sentetik stok: minimum, aylık ortalama satışın iki katı; stok 0 ile minimumun 4 katı arası.
            min_stock = max(2, round(2 * quantities[product_id] / months))
            rows.append(
                {
                    "sku": f"OL-{product_id[:12].upper()}",
                    "name": f"{category} · {product_id[:6].upper()}",
                    "category_id": category_ids[category],
                    "sale_price": sale_price,
                    "cost_price": (sale_price * COST_RATIO).quantize(CENT, ROUND_HALF_UP),
                    "stock": rng.randint(0, 4 * min_stock),
                    "min_stock": min_stock,
                    "is_active": True,
                    "source": RecordSource.OLIST,
                    "external_id": product_id,
                }
            )
        ids: dict[str, int] = {}
        for batch in _batched(rows):
            ids.update(self.db.execute(insert(Product).returning(Product.external_id, Product.id), batch).all())
        summary.products = len(rows)
        self.log(f"Ürünler: {len(rows)}")
        return ids

    def _load_customers(self, customers, summary) -> dict[str, int]:
        unique = {}
        for row in sorted(customers.values(), key=lambda r: r["customer_unique_id"]):
            unique.setdefault(row["customer_unique_id"], row)
        start = (self.db.scalar(select(func.count()).where(Customer.source == RecordSource.OLIST)) or 0) + 1
        rows = [
            {
                "full_name": f"Müşteri {start + i:05d}",
                "email": f"olist-{start + i:05d}@example.com",
                "city": f"{row['customer_city'].title()} / {row['customer_state']}"[:100],
                "is_active": True,
                "source": RecordSource.OLIST,
                "external_id": unique_id,
            }
            for i, (unique_id, row) in enumerate(unique.items())
        ]
        ids: dict[str, int] = {}
        for batch in _batched(rows):
            ids.update(self.db.execute(insert(Customer).returning(Customer.external_id, Customer.id), batch).all())
        summary.customers = len(rows)
        self.log(f"Müşteriler: {len(rows)}")
        return ids

    def _load_orders(self, orders, lines, customers, customer_ids, product_ids, payments, scale, summary) -> None:
        first = _timestamp(orders[0]["order_purchase_timestamp"]) if orders else None
        last = _timestamp(orders[-1]["order_purchase_timestamp"]) if orders else None
        span = timedelta(days=(last - first).days + 1) if orders else timedelta(0)

        for copy in range(scale):
            # Deney 2 için çoğaltma: her kopya, veri setinin süresi kadar geriye kaydırılır.
            shift, suffix = span * copy, f"-S{copy}" if copy else ""
            order_rows, item_rows = [], []
            for row in orders:
                order_lines = lines[row["order_id"]]
                total = sum((sum(item_prices) for item_prices in order_lines.values()), Decimal("0"))
                status = STATUS_MAP.get(row["order_status"], OrderStatus.PREPARING)

                def at(column: str, *, _row=row, _shift=shift) -> datetime | None:
                    value = _timestamp(_row.get(column))
                    return value - _shift if value else None

                order_rows.append(
                    {
                        "order_code": f"OL-{row['order_id']}{suffix}"[:40],
                        "customer_id": customer_ids[customers[row["customer_id"]]["customer_unique_id"]],
                        "status": status,
                        "total_amount": total,
                        "payment_method": PAYMENT_MAP.get(payments.get(row["order_id"], ""), PaymentMethod.CREDIT_CARD),
                        "created_at": at("order_purchase_timestamp"),
                        "updated_at": at("order_purchase_timestamp"),
                        "approved_at": at("order_approved_at"),
                        "shipped_at": at("order_delivered_carrier_date"),
                        "completed_at": at("order_delivered_customer_date")
                        if status == OrderStatus.COMPLETED
                        else None,
                        "source": RecordSource.OLIST,
                        "external_id": f"{row['order_id']}{suffix}",
                    }
                )
            order_ids: dict[str, int] = {}
            for batch in _batched(order_rows):
                order_ids.update(self.db.execute(insert(Order).returning(Order.external_id, Order.id), batch).all())
            for row in orders:
                order_id = order_ids[f"{row['order_id']}{suffix}"]
                for product_id, item_prices in lines[row["order_id"]].items():
                    line_total = sum(item_prices, Decimal("0"))
                    item_rows.append(
                        {
                            "order_id": order_id,
                            "product_id": product_ids[product_id],
                            "quantity": len(item_prices),
                            "unit_price": (line_total / len(item_prices)).quantize(CENT, ROUND_HALF_UP),
                            "line_total": line_total,
                        }
                    )
            for batch in _batched(item_rows):
                self.db.execute(insert(OrderItem), batch)
            summary.orders += len(order_rows)
            summary.order_items += len(item_rows)
            self.log(f"Siparişler: {summary.orders} (kalem: {summary.order_items})")
