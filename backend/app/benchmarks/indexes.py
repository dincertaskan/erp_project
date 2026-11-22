"""Deney 2: sorgu indekslerinin etkisi.

0002 göçündeki indeksler kaldırılıp geri eklenerek her sorgu iki koşulda ölçülür (indeksli / indekssiz).
Her koşulda tablolara ANALYZE uygulanır; her sorgu için ilk koşu ısınma olarak atılır, ardından N kez
EXPLAIN (ANALYZE, BUFFERS) çalıştırılır. Sonuç CSV olarak standart çıktıya yazılır; ilerleme stderr'e.

İndeksler göç geri alınarak değil doğrudan kaldırılır: `alembic downgrade 0001` sonraki göçleri de
(sipariş kodu dizisi) geri alacağı için. İndeksler her durumda, hata olsa bile, geri eklenir.

Kullanım (backend konteynerinde):
    docker compose exec -T backend python -m app.benchmarks.indexes --repetitions 30 > experiments/results/deney2.csv
"""

from __future__ import annotations

import argparse
import csv
import importlib.util
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.engine import Connection

from app.core.database import engine

MIGRATION = Path(__file__).resolve().parents[2] / "migrations" / "versions" / "0002_add_query_indexes.py"
REVENUE = "('preparing', 'shipped', 'completed')"

# Ölçülen sorgular: dashboard, sipariş listesi, raporlar ve stok geçmişi. Uygulamanın ürettiği sorguların
# sadeleştirilmiş SQL karşılıkları; parametreler verideki en son tarihe göre seçilir (Olist 2016-2018).
QUERIES = {
    "dashboard_ay_satisi": f"""
        SELECT coalesce(sum(total_amount), 0), count(*) FROM orders
        WHERE status IN {REVENUE} AND created_at >= :month_start AND created_at < :now""",
    "dashboard_gunluk_trend": f"""
        SELECT date_trunc('day', timezone('Europe/Istanbul', created_at)) AS d, sum(total_amount), count(*)
        FROM orders WHERE status IN {REVENUE} AND created_at >= :days_30 GROUP BY d""",
    "dashboard_en_cok_satan": f"""
        SELECT p.id, sum(oi.quantity) AS q FROM order_items oi
        JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id
        WHERE o.status IN {REVENUE} AND o.created_at >= :month_start
        GROUP BY p.id ORDER BY q DESC LIMIT 5""",
    "siparis_listesi_durum": """
        SELECT id FROM orders WHERE status = 'pending' ORDER BY created_at DESC, id DESC LIMIT 20""",
    "siparis_listesi_tarih": """
        SELECT id FROM orders WHERE created_at >= :days_30 AND created_at < :now
        ORDER BY created_at DESC, id DESC LIMIT 20""",
    "musteri_siparisleri": """
        SELECT id FROM orders WHERE customer_id = :customer_id ORDER BY created_at DESC, id DESC LIMIT 20""",
    "rapor_urun_bazinda": f"""
        SELECT oi.product_id, count(DISTINCT o.id), sum(oi.quantity), sum(oi.line_total)
        FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.status IN {REVENUE} AND o.created_at >= :months_3 AND o.created_at < :now
        GROUP BY oi.product_id""",
    "rapor_musteri_istatistigi": f"""
        SELECT customer_id, count(*), sum(total_amount) FILTER (WHERE status IN {REVENUE}), max(created_at)
        FROM orders GROUP BY customer_id ORDER BY 3 DESC NULLS LAST LIMIT 20""",
    "urun_satis_gecmisi": """
        SELECT o.id FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE oi.product_id = :product_id ORDER BY o.created_at DESC LIMIT 20""",
}

TABLES = ("products", "orders", "order_items", "order_status_history", "stock_movements")


def load_indexes() -> list[tuple[str, str, list[str]]]:
    spec = importlib.util.spec_from_file_location("migration_0002", MIGRATION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module.INDEXES


def drop_indexes(conn: Connection, indexes) -> None:
    for name, _, _ in indexes:
        conn.execute(text(f'DROP INDEX IF EXISTS "{name}"'))


def create_indexes(conn: Connection, indexes) -> None:
    for name, table, columns in indexes:
        conn.execute(text(f'CREATE INDEX IF NOT EXISTS "{name}" ON {table} ({", ".join(columns)})'))


def parameters(conn: Connection) -> dict:
    now = conn.scalar(text("SELECT max(created_at) FROM orders")) or datetime.now()
    customer_id = conn.scalar(
        text("SELECT customer_id FROM orders GROUP BY customer_id ORDER BY count(*) DESC LIMIT 1")
    )
    product_id = conn.scalar(
        text("SELECT product_id FROM order_items GROUP BY product_id ORDER BY count(*) DESC LIMIT 1")
    )
    return {
        "now": now,
        "month_start": now.replace(day=1, hour=0, minute=0, second=0, microsecond=0),
        "days_30": now - timedelta(days=30),
        "months_3": now - timedelta(days=90),
        "customer_id": customer_id or 0,
        "product_id": product_id or 0,
    }


def explain(conn: Connection, sql: str, params: dict) -> tuple[float, float, int, int]:
    plan = conn.scalar(text(f"EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) {sql}"), params)
    root = (json.loads(plan) if isinstance(plan, str) else plan)[0]
    buffers = root["Plan"]
    return (
        root["Execution Time"],
        root["Planning Time"],
        buffers.get("Shared Hit Blocks", 0),
        buffers.get("Shared Read Blocks", 0),
    )


def measure(conn: Connection, condition: str, repetitions: int, params: dict, writer, log) -> None:
    for table in TABLES:
        conn.execute(text(f"ANALYZE {table}"))
    for name, sql in QUERIES.items():
        explain(conn, sql, params)  # ısınma
        for repetition in range(1, repetitions + 1):
            execution, planning, hit, read = explain(conn, sql, params)
            writer.writerow([condition, name, repetition, round(execution, 3), round(planning, 3), hit, read])
        log(f"{condition:<10} {name}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Deney 2: indeksli ve indekssiz sorgu süreleri")
    parser.add_argument("--repetitions", type=int, default=30)
    args = parser.parse_args()

    def log(message: str) -> None:
        print(message, file=sys.stderr, flush=True)

    indexes = load_indexes()
    writer = csv.writer(sys.stdout)
    writer.writerow(["condition", "query", "repetition", "execution_ms", "planning_ms", "shared_hit", "shared_read"])
    with engine.connect() as conn:
        conn = conn.execution_options(isolation_level="AUTOCOMMIT")
        counts = conn.execute(text("SELECT (SELECT count(*) FROM orders), (SELECT count(*) FROM order_items)")).one()
        log(f"Veri: {counts[0]} sipariş, {counts[1]} sipariş kalemi")
        params = parameters(conn)
        try:
            create_indexes(conn, indexes)
            measure(conn, "indeksli", args.repetitions, params, writer, log)
            drop_indexes(conn, indexes)
            measure(conn, "indekssiz", args.repetitions, params, writer, log)
        finally:
            create_indexes(conn, indexes)
            conn.execute(text("ANALYZE"))
            log("İndeksler geri eklendi.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
