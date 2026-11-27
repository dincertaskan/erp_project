"""login attempts table

Hatalı giriş denemeleri bellekten veritabanına taşınır: sayaç e-posta ve IP başına tutulur, uygulama yeniden
başlayınca korunur ve birden fazla uvicorn süreci aynı sayacı görür.

Revision ID: 0006
Revises: 0005
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | Sequence[str] | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "login_attempts",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("ip_address", sa.String(length=45), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_login_attempts")),
    )
    op.create_index("ix_login_attempts_email_created_at", "login_attempts", ["email", "created_at"])
    op.create_index("ix_login_attempts_ip_address_created_at", "login_attempts", ["ip_address", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_login_attempts_ip_address_created_at", table_name="login_attempts")
    op.drop_index("ix_login_attempts_email_created_at", table_name="login_attempts")
    op.drop_table("login_attempts")
