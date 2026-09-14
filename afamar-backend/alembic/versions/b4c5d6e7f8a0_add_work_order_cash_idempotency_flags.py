"""add work order cash idempotency flags

Guarantee that each Work Order's money enters the cash box EXACTLY once,
regardless of duplicate POSTs or re-saves (the "señas fantasma" + duplicate
order incidents).

Two boolean flags on `work_orders`:
- `sena_registered` (BOOLEAN, NOT NULL, default 0): the initial seña/deposit
  has already been booked as a cash INCOME at create()/create_from_budget().
- `saldo_registered` (BOOLEAN, NOT NULL, default 0): the remaining balance
  (balance_due) has already been booked as a cash INCOME when the WO
  transitioned to DELIVERED.

Both are set server-side in the same transaction that books the movement;
once set they make any further booking a no-op. `server_default` (not a
backfill) is used so existing rows default to 0 — only new WOs are
protected.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b4c5d6e7f8a0"
down_revision: Union[str, None] = "a9b8c7d6e5f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "work_orders",
        sa.Column(
            "sena_registered",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )
    op.add_column(
        "work_orders",
        sa.Column(
            "saldo_registered",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )


def downgrade() -> None:
    op.drop_column("work_orders", "saldo_registered")
    op.drop_column("work_orders", "sena_registered")
