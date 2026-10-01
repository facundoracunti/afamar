"""persist Budget discount_enabled + discount_target to the DB

Mirror of the `work_orders` migration g9h0i1j2k3l4, applied to
`budgets`. The commercial-discount gate (`discount_enabled` + the
`discount_target` base) was frontend-only on budgets too: the budget
form kept them in client state and built the displayed total in
`useBudgetCalculations` / `buildPdfData`, while the backend only
persisted the legacy `discount_percentage` / `discount_fixed_amount`.

This migration:

1. Adds the two columns (`discount_enabled` Boolean NOT NULL default
   false; `discount_target` String(20) NOT NULL default 'total'). The
   budget form default is 'total' (whole document) — unlike the work
   order, whose default is 'materials'.
2. Backfills `discount_target` to 'total' for any row where the
   server default didn't catch (defensive — should be a no-op given
   the server_default, but keeps SQLite + MySQL consistent).

Budgets remain pure quote documents: the backend still does NOT run
the pricing formula (the total the customer sees is the frontend-computed
one). The columns exist so the Budget→work-order conversion
(`create_from_budget` in app/services/work_order.py and
`convert_alternative_to_work_order` in app/services/budget.py) can copy
the gate + target verbatim when it carries over the discount.

The migration is **idempotent**: the column-add is guarded by an
information_schema check so re-running it is a no-op instead of
failing with `Duplicate column name`.

Additive / safe.

Revision ID: j0k1l2m3n4o5
Revises: i0j1k2l3m4n5
Create Date: 2026-10-01 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "j0k1l2m3n4o5"
down_revision: Union[str, None] = "i0j1k2l3m4n5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str) -> bool:
    """Returns True if `column_name` already exists on `table_name`."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return any(col["name"] == column_name for col in inspector.get_columns(table_name))


def upgrade() -> None:
    if not _column_exists("budgets", "discount_enabled"):
        op.add_column(
            "budgets",
            sa.Column(
                "discount_enabled",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("0"),
            ),
        )
    if not _column_exists("budgets", "discount_target"):
        op.add_column(
            "budgets",
            sa.Column(
                "discount_target",
                sa.String(length=20),
                nullable=False,
                # MySQL needs quoted strings in DEFAULT; `total` bare would be
                # parsed as a column reference and fail.
                server_default=sa.text("'total'"),
            ),
        )
    # Defensive backfill (idempotent — server_default should have covered
    # all existing rows, but on MySQL some `add_column` paths don't
    # honor server_default for pre-existing rows).
    op.execute(
        "UPDATE budgets SET discount_target = 'total' "
        "WHERE discount_target IS NULL OR discount_target = ''"
    )


def downgrade() -> None:
    op.drop_column("budgets", "discount_target")
    op.drop_column("budgets", "discount_enabled")