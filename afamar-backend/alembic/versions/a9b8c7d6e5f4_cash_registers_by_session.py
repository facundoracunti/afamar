"""cash registers by session (on-demand numbered boxes)

Replaces the daily-cash model (one register per `date`, unique) with
on-demand "session boxes" that reflect how the shop actually works: the
operator opens a box when they want (not on a fixed day/week), lets it
span several days, and closes it whenever it suits them. Closing a box
automatically opens the next one, which is why there is always exactly
one open box.

Key changes to `daily_cash`:
- `number` (INTEGER, nullable): session numbering 1, 2, 3... continuous,
  independent of the day. Computed as `max(number) + 1` in the repository
  (NOT a DB unique, to coexist with legacy rows that have NULL number and
  because concurrency is a single operator).
- `opened_at` (DateTime): when the box was opened (nullable for legacy).
- `closed_at` (DateTime): when the box was closed (nullable while open).
- `date` is no longer unique: a box is no longer the "register for that
  day". The column is kept (nullable usage in legacy/frontend) but the
  unique index `ix_daily_cash_date` is dropped.

No backfill of existing daily-cash rows: the user chose to start the new
session numbering from scratch (legacy rows keep `number = NULL`).

Revision ID: a9b8c7d6e5f4
Revises: f7a8b9c0d1e2
Create Date: 2026-08-31 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a9b8c7d6e5f4"
down_revision: Union[str, None] = "f7a8b9c0d1e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Batch mode so the unique drop works portably (SQLite rebuilds the
    # table) and adds the new session columns in the same pass.
    with op.batch_alter_table("daily_cash", schema=None) as batch_op:
        batch_op.drop_index("ix_daily_cash_date")
        batch_op.add_column(sa.Column("number", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("opened_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("closed_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("daily_cash", schema=None) as batch_op:
        batch_op.drop_column("closed_at")
        batch_op.drop_column("opened_at")
        batch_op.drop_column("number")
        batch_op.create_index("ix_daily_cash_date", ["date"], unique=True)
