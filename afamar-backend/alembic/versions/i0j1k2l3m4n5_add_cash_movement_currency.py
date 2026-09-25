"""track native currency on cash_movements for USD (dólar billete) payments

When the operator registers a payment in USD ("Dólar billete") in the Work
Order payment module, the frontend posts to `POST /cash/movements` with:

    { amount: 1400, currency: "USD", amount_ars: 2170000, usd_rate: 1550, ... }

`amount` keeps the NATIVE USD value (what the client handed over), while
`amount_ars` and `usd_rate` let the box totals stay ARS-consistent (all the
box math — income/expenses/total_sum/current_balance/real_cash — sums the
ARS equivalent, never the raw USD). Up until this migration `cash_movements`
had no currency columns, so Pydantic stripped `currency`/`amount_ars`/
`usd_rate` from the payload and a USD payment was silently recorded as ARS.

This migration:

1. Adds `currency VARCHAR(10) NOT NULL DEFAULT 'ARS'` — legacy rows (all ARS)
   keep 'ARS', no backfill needed.
2. Adds `amount_ars FLOAT NULL` and `usd_rate FLOAT NULL` (only set for USD
   movements; NULL for ARS = "amount is already the ARS value").
3. Is **idempotent** via an `_column_exists` guard so re-runs are no-ops.

Additive / safe: one NOT NULL column with a server default + two nullable
columns. Single operator; SQLite in dev, MySQL in prod.

Revision ID: i0j1k2l3m4n5
Revises: h0i1j2k3l4m5
Create Date: 2026-09-25 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "i0j1k2l3m4n5"
down_revision: Union[str, None] = "h0i1j2k3l4m5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return any(col["name"] == column_name for col in inspector.get_columns(table_name))


def upgrade() -> None:
    if not _column_exists("cash_movements", "currency"):
        op.add_column(
            "cash_movements",
            sa.Column("currency", sa.String(10), nullable=False, server_default="ARS"),
        )
    if not _column_exists("cash_movements", "amount_ars"):
        op.add_column(
            "cash_movements",
            sa.Column("amount_ars", sa.Float(), nullable=True),
        )
    if not _column_exists("cash_movements", "usd_rate"):
        op.add_column(
            "cash_movements",
            sa.Column("usd_rate", sa.Float(), nullable=True),
        )


def downgrade() -> None:
    if _column_exists("cash_movements", "currency"):
        op.drop_column("cash_movements", "currency")
    if _column_exists("cash_movements", "amount_ars"):
        op.drop_column("cash_movements", "amount_ars")
    if _column_exists("cash_movements", "usd_rate"):
        op.drop_column("cash_movements", "usd_rate")