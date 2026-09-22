"""persist payway_checkout_url on cash_movements

When the operator picks "Link de pago (Payway)" in the cash modal and
clicks "Generar link", the frontend posts to
`POST /payments/payway/checkout`, the backend returns the gateway's
checkout URL, and the frontend persists it on the cash movement as
`payway_checkout_url`. Until this migration the column did not exist, so
Pydantic stripped it from the response (Pydantic v2 default = ignore
extras) and the UI fell back to showing a generic placeholder.

This migration:

1. Adds `payway_checkout_url TEXT NULL` to `cash_movements` (Text rather
   than VARCHAR because some gateways embed signed JWTs >255 chars).
2. Backfills existing rows to NULL (default — no real URLs to migrate).
3. Is **idempotent** via an `_column_exists` guard so re-runs are
   no-ops.

Additive / safe: nullable column with NULL default. No destructive ops.
Single operator; SQLite in dev, MySQL in prod.

Revision ID: h0i1j2k3l4m5
Revises: g9h0i1j2k3l4
Create Date: 2026-09-21 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "h0i1j2k3l4m5"
down_revision: Union[str, None] = "g9h0i1j2k3l4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return any(col["name"] == column_name for col in inspector.get_columns(table_name))


def upgrade() -> None:
    if not _column_exists("cash_movements", "payway_checkout_url"):
        op.add_column(
            "cash_movements",
            sa.Column("payway_checkout_url", sa.Text(), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("cash_movements", "payway_checkout_url")
