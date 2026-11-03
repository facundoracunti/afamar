"""Persist exact and contractual totals for silent ARS rounding.

All columns are nullable so historical budgets and work orders remain byte
for byte compatible and are never rounded merely by being read or edited.
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "n4o5p6q7r8s9"
down_revision: str | None = "m3n4o5p6q7r8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_COLUMNS = (
    "total_exact_ars",
    "total_exact_usd",
    "rounding_adjustment_ars",
    "rounding_adjustment_usd",
    "total_contractual_ars",
    "total_contractual_usd",
)
_MONEY = sa.Numeric(18, 2)


def upgrade() -> None:
    for table in ("budgets", "work_orders"):
        for column in _COLUMNS:
            op.add_column(table, sa.Column(column, _MONEY, nullable=True))
    for column in (
        "new_total_exact_ars",
        "new_total_exact_usd",
        "rounding_adjustment_ars",
        "rounding_adjustment_usd",
    ):
        op.add_column(
            "work_order_measurement_approvals",
            sa.Column(column, _MONEY, nullable=True),
        )


def downgrade() -> None:
    for table in ("work_orders", "budgets"):
        for column in reversed(_COLUMNS):
            op.drop_column(table, column)
    for column in (
        "rounding_adjustment_usd",
        "rounding_adjustment_ars",
        "new_total_exact_usd",
        "new_total_exact_ars",
    ):
        op.drop_column("work_order_measurement_approvals", column)
