"""customer invite codes

Uygulamada açılan müşteri kartı, aynı e-postayla kayıt olan kişiye artık otomatik bağlanmaz; yöneticinin
ürettiği tek kullanımlık davet kodu gerekir. Kodun yalnızca özeti ve son geçerlilik zamanı saklanır.

Revision ID: 0005
Revises: 0004
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | Sequence[str] | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("customers", sa.Column("invite_code_digest", sa.String(length=64), nullable=True))
    op.add_column("customers", sa.Column("invite_expires_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("customers", "invite_expires_at")
    op.drop_column("customers", "invite_code_digest")
