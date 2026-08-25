"""add installment_detail_ars/usd to budgets and work_orders

Persists the per-cuota breakdown that `_recalculate_totals_from_items`
and `_resolve_catalogue_adjustment` already compute for the credit-card
surcharge (interés incremental). The form hook and `buildPdfData` (PDF
preview) rely on this snapshot so the per-cuota table renders even
when the PDF is regenerated from a stored budget / work order that
was loaded via the list page (no live form state to re-derive it
from).

- `installment_detail_ars` (TEXT, JSON-encoded list[dict]): one row
  per cuota for the ARS total.
- `installment_detail_usd` (TEXT, JSON-encoded list[dict]): one row
  per cuota for the USD total.

Both default to NULL (no per-cuota breakdown) so legacy rows keep
their pre-migration behaviour. The recalc helper writes them on
every save when the active payment method is a credit-card
percentage surcharge with installments >= 1; the PDF re-derives
the table from the active catalogue row when the snapshot is empty
(so this column is the *fast path*, not the only path).

Revision ID: d5e6f7a8b9c0
Revises: b3c4d5e6f7a9
Create Date: 2026-08-23 23:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d5e6f7a8b9c0"
down_revision: Union[str, None] = "b3c4d5e6f7a9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for table in ("budgets", "work_orders"):
        op.add_column(
            table,
            sa.Column(
                "installment_detail_ars",
                sa.Text(),
                nullable=True,
            ),
        )
        op.add_column(
            table,
            sa.Column(
                "installment_detail_usd",
                sa.Text(),
                nullable=True,
            ),
        )


def downgrade() -> None:
    for table in ("budgets", "work_orders"):
        op.drop_column(table, "installment_detail_usd")
        op.drop_column(table, "installment_detail_ars")
