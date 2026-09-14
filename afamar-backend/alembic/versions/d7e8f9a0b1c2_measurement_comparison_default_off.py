"""make measurement comparison OPT-IN (default off)

The COMPARATIVA DE MEDICIÓN checkbox is now opt-in: the operator checks it
manually per order. Previously the column defaulted to `1` (true), so:
- All existing `work_orders` rows carry `include_measurement_comparison_in_pdf = 1`.
- New rows created without an explicit value would inherit the same default.

This migration:
1. Flips the column's server default from `1` to `0` so newly inserted rows
   (e.g. created via raw SQL or `create_from_budget` without the flag) come
   out off unless the operator opts in.
2. Backfills existing rows to `0` so the turned-off default applies uniformly.

Additive/safe: no data other than the one flag is touched, and the table is
not locked (single operator; SQLite in dev, MySQL in prod).

Revision ID: d7e8f9a0b1c2
Revises: c5d6e7f8a9b1
Create Date: 2026-09-11 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d7e8f9a0b1c2"
down_revision: Union[str, None] = "c5d6e7f8a9b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "work_orders",
        "include_measurement_comparison_in_pdf",
        existing_type=sa.Boolean(),
        server_default=sa.text("0"),
        existing_nullable=False,
    )
    op.execute(
        "UPDATE work_orders SET include_measurement_comparison_in_pdf = 0"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE work_orders SET include_measurement_comparison_in_pdf = 1"
    )
    op.alter_column(
        "work_orders",
        "include_measurement_comparison_in_pdf",
        existing_type=sa.Boolean(),
        server_default=sa.text("1"),
        existing_nullable=False,
    )