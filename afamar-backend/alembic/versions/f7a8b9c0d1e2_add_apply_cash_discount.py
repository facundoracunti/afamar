"""add apply_cash_discount to work_orders

Per-order flag controlling whether the operator chooses to apply the
DISCOUNT configured on the selected payment method (e.g. "Efectivo
7% descuento promocional"). Mirrors `include_measurement_comparison_in_pdf`
so the operator decides client-by-client whether the promotional
discount applies. Without this flag the discount was applied
automatically just by selecting "Efectivo", which surprised the operator
when the same payment method showed a discount on orders where the
client had already negotiated the price.

- `apply_cash_discount` (BOOLEAN, NOT NULL, default 0): off by default so
  existing orders retain their current total unless the operator opts
  in.

Revision ID: f7a8b9c0d1e2
Revises: e6f7a8b9c0d1
Create Date: 2026-08-30 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f7a8b9c0d1e2"
down_revision: Union[str, None] = "e6f7a8b9c0d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "work_orders",
        sa.Column(
            "apply_cash_discount",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )


def downgrade() -> None:
    op.drop_column("work_orders", "apply_cash_discount")