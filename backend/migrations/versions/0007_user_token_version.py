"""user token version

JWT'ye yazılan token sürümü. Çıkış ve şifre değişikliği sürümü artırır; eski token'lar geçersizleşir.
Bu göçten önce verilen token'larda sürüm bulunmadığından hepsi geçersiz sayılır (kullanıcılar bir kez yeniden
giriş yapar).

Revision ID: 0007
Revises: 0006
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | Sequence[str] | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("token_version", sa.Integer(), server_default="0", nullable=False))


def downgrade() -> None:
    op.drop_column("users", "token_version")
