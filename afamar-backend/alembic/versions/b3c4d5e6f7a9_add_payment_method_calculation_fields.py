"""add calculation fields to payment_methods

Extends the `payment_methods` reference table (already FK'd from
`budgets.payment_method_id` and `work_orders.payment_method_id`) with
the four columns the catalogue needs to model a discount or surcharge:

- `type` (DISCOUNT | SURCHARGE | NONE): direction of the value
- `value` (float): the raw amount (currency-agnostic; the operator
  decides whether it represents a percentage via `is_percentage` or
  a fixed amount in ARS)
- `is_percentage` (bool): if TRUE, `value` is interpreted as percent
- `applies_to_installments` (bool): if TRUE, the value scales with
  the installment count (legacy behaviour for credit-card surcharges:
  N * 5% for N >= 3)

Existing rows backfill to the no-op defaults (type='NONE', value=0),
so legacy budgets/work orders that match by `payment_method` string
keep their current calculation unchanged.

Revision ID: b3c4d5e6f7a9
Revises: c7d8e9f0a1b2
Create Date: 2026-08-20 08:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b3c4d5e6f7a9'
down_revision: Union[str, None] = 'c7d8e9f0a1b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "payment_methods",
        sa.Column(
            "type",
            sa.String(length=20),
            nullable=False,
            server_default="NONE",
        ),
    )
    op.add_column(
        "payment_methods",
        sa.Column(
            "value",
            sa.Float(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "payment_methods",
        sa.Column(
            "is_percentage",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )
    op.add_column(
        "payment_methods",
        sa.Column(
            "applies_to_installments",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )


def downgrade() -> None:
    op.drop_column("payment_methods", "applies_to_installments")
    op.drop_column("payment_methods", "is_percentage")
    op.drop_column("payment_methods", "value")
    op.drop_column("payment_methods", "type")
