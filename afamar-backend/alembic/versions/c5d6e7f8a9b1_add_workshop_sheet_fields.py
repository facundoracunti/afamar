"""add workshop sheet fields to work orders

Workshop sheet ("FICHA DE TALLER") fields — printed BLANK on the taller PDF
so the shop-floor workers fill them by hand with pen (they don't work on
computers). Technical spec grid: Corte, Faja, Perf, Tras/PEG, Terminación,
Sopapas.

Six nullable String(100) columns on `work_orders` following the existing
`color`/`thickness`/`finish`/`bacha`/`anafe` pattern. Additive + nullable so
no backfill is needed for existing rows.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c5d6e7f8a9b1"
down_revision: Union[str, None] = "b4c5d6e7f8a0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "work_orders",
        sa.Column("workshop_corte", sa.String(100), nullable=True),
    )
    op.add_column(
        "work_orders",
        sa.Column("workshop_faja", sa.String(100), nullable=True),
    )
    op.add_column(
        "work_orders",
        sa.Column("workshop_perf", sa.String(100), nullable=True),
    )
    op.add_column(
        "work_orders",
        sa.Column("workshop_tras_peg", sa.String(100), nullable=True),
    )
    op.add_column(
        "work_orders",
        sa.Column("workshop_term", sa.String(100), nullable=True),
    )
    op.add_column(
        "work_orders",
        sa.Column("workshop_sopapas", sa.String(100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("work_orders", "workshop_sopapas")
    op.drop_column("work_orders", "workshop_term")
    op.drop_column("work_orders", "workshop_tras_peg")
    op.drop_column("work_orders", "workshop_perf")
    op.drop_column("work_orders", "workshop_faja")
    op.drop_column("work_orders", "workshop_corte")