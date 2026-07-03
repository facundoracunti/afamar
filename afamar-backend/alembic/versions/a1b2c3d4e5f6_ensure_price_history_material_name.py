"""Ensure `price_history.material_name` exists (idempotent).

The `material_name` column is part of the initial schema and the SQLAlchemy
model declares it. Some MySQL deployments were created before the column
was added; this migration is a no-op for SQLite/already-up-to-date DBs
and ADDs the column when missing.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "15a75ef09120"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    """Lightweight check that works on both SQLite and MySQL."""
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return column in {c["name"] for c in insp.get_columns(table)}


def upgrade() -> None:
    if not _column_exists("price_history", "material_name"):
        op.add_column(
            "price_history",
            sa.Column("material_name", sa.String(length=200), nullable=True),
        )


def downgrade() -> None:
    if _column_exists("price_history", "material_name"):
        op.drop_column("price_history", "material_name")
