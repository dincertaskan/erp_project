"""order code sequence

Revision ID: 0003
Revises: 0002
"""

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE SEQUENCE order_code_seq")


def downgrade() -> None:
    op.execute("DROP SEQUENCE order_code_seq")
