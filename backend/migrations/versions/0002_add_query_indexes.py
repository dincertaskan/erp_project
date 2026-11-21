"""add query indexes

Liste, dashboard ve rapor sorguları için indeksler. Deney 2'de indekssiz
durum bu göç geri alınarak ölçülür (alembic downgrade 0001).

Revision ID: 0002
Revises: 0001
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0002"
down_revision: str | Sequence[str] | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

INDEXES = [
    ("ix_products_category_id", "products", ["category_id"]),
    ("ix_orders_created_at", "orders", ["created_at"]),
    ("ix_orders_customer_id", "orders", ["customer_id"]),
    ("ix_orders_status", "orders", ["status"]),
    ("ix_order_items_order_id", "order_items", ["order_id"]),
    ("ix_order_items_product_id", "order_items", ["product_id"]),
    ("ix_order_status_history_order_id", "order_status_history", ["order_id"]),
    ("ix_stock_movements_product_id_created_at", "stock_movements", ["product_id", "created_at"]),
    ("ix_stock_movements_created_at", "stock_movements", ["created_at"]),
]


def upgrade() -> None:
    for name, table, columns in INDEXES:
        op.create_index(name, table, columns)


def downgrade() -> None:
    for name, table, _ in reversed(INDEXES):
        op.drop_index(name, table_name=table)
