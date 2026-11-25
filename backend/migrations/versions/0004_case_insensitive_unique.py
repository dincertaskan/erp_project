"""case-insensitive unique indexes and stock movement foreign key indexes

E-posta ve kategori adı benzersizliği büyük/küçük harf duyarsız hale gelir. Mevcut veride yalnızca
harf büyüklüğü farklı kopyalar varsa göç benzersiz indeks oluşturulurken durur; önce temizlenmelidir.

Revision ID: 0004
Revises: 0003
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | Sequence[str] | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# (tablo, sütun, eski kısıt, yeni indeks)
CASE_INSENSITIVE = [
    ("users", "email", "uq_users_email", "uq_users_email_lower"),
    ("customers", "email", "uq_customers_email", "uq_customers_email_lower"),
    ("categories", "name", "uq_categories_name", "uq_categories_name_lower"),
]

INDEXES = [
    ("ix_stock_movements_order_id", "stock_movements", ["order_id"]),
    ("ix_stock_movements_user_id", "stock_movements", ["user_id"]),
]


def upgrade() -> None:
    for table, column, constraint, index in CASE_INSENSITIVE:
        op.create_index(index, table, [sa.text(f"lower({column})")], unique=True)
        op.drop_constraint(constraint, table, type_="unique")
    for name, table, columns in INDEXES:
        op.create_index(name, table, columns)


def downgrade() -> None:
    for name, table, _ in reversed(INDEXES):
        op.drop_index(name, table_name=table)
    for table, column, constraint, index in reversed(CASE_INSENSITIVE):
        op.create_unique_constraint(constraint, table, [column])
        op.drop_index(index, table_name=table)
