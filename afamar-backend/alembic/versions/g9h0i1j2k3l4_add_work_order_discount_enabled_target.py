"""persist WorkOrder discount_enabled + discount_target to the DB

Until now, the WorkOrder model only persisted the legacy
`discount_percentage` / `discount_fixed_amount` columns. The
`discount_enabled` gate (frontend "Aplicar descuento" checkbox) and
`discount_target` ('materials' | 'total') were kept in client-side
state only, which meant:

  - The PUT /work-orders/{id} payload included them, but the backend
    silently dropped them (Pydantic stripped them because the schema
    didn't declare the fields).
  - The GET /work-orders/{id} response therefore always returned
    `discount_enabled = false`, regardless of what the operator had
    configured. The frontend had to guess from localStorage hacks
    to keep the checkbox ticked on reload / cross-navigation.

This migration:

1. Adds the two columns (`discount_enabled` Boolean NOT NULL default
   false; `discount_target` String(20) NOT NULL default 'materials').
   Server defaults make the migration safe to run on a non-empty
   table — every existing row backfills to the documented defaults.
2. Backfills `discount_target` to 'materials' for any row where the
   server default didn't catch (defensive — should be a no-op given
   the server_default, but keeps SQLite + MySQL consistent).

The migration is **idempotent**: the column-add is guarded by an
information_schema check so re-running it (or running it on a DB
where the columns were already added by another path / hand) is a
no-op instead of failing with `Duplicate column name`.

Additive / safe: only adds two nullable=false columns with default
values and one UPDATE statement. No destructive ops, no locks held
beyond the column-add metadata lock (single operator; SQLite in dev,
MySQL in prod).

Revision ID: g9h0i1j2k3l4
Revises: f8e7d6c5b4a3
Create Date: 2026-09-21 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "g9h0i1j2k3l4"
down_revision: Union[str, None] = "f8e7d6c5b4a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str) -> bool:
    """Returns True if `column_name` already exists on `table_name`."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return any(col["name"] == column_name for col in inspector.get_columns(table_name))


def upgrade() -> None:
    if not _column_exists("work_orders", "discount_enabled"):
        op.add_column(
            "work_orders",
            sa.Column(
                "discount_enabled",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("0"),
            ),
        )
    if not _column_exists("work_orders", "discount_target"):
        op.add_column(
            "work_orders",
            sa.Column(
                "discount_target",
                sa.String(length=20),
                nullable=False,
                # MySQL needs quoted strings in DEFAULT; `materials` bare
                # would be parsed as a column reference and fail.
                server_default=sa.text("'materials'"),
            ),
        )
    # Defensive backfill (idempotent — server_default should have covered
    # all existing rows, but on MySQL some `add_column` paths don't
    # honor server_default for pre-existing rows).
    op.execute(
        "UPDATE work_orders SET discount_target = 'materials' "
        "WHERE discount_target IS NULL OR discount_target = ''"
    )


def downgrade() -> None:
    op.drop_column("work_orders", "discount_target")
    op.drop_column("work_orders", "discount_enabled")
