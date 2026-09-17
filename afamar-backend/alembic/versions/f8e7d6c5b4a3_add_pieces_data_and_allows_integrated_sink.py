"""add pieces_data and allows_integrated_sink

Multi-piece budget model (the "modo piezas" flow). Additive columns so
existing budgets / work orders / materials keep working unchanged:

- `pieces_data` (TEXT, NULL) on `budgets` and `work_orders`: JSON snapshot
  of `BudgetPiece[]` — each piece carries its own mesada dimensions, main
  material, alternative materials and their own additional works. NULL /
  empty → legacy budget as today. Mirrors `additional_works_data` (TEXT,
  additive, no backfill).

- `allows_integrated_sink` (BOOLEAN, NOT NULL, default 1) on `materials`:
  whether the "BACHA INTEGRADA" additional work may be chosen for this
  material (some porous granites, e.g. DALLAS, can't carry one). Default
  true so the existing catalogue keeps current behaviour; the materials
  seeder pins the exceptions to false.

All three are additive + nullable (or defaulted), so no backfill needed.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f8e7d6c5b4a3"
down_revision: Union[str, None] = "e2f3a4b5c6d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "budgets",
        sa.Column("pieces_data", sa.Text(), nullable=True),
    )
    op.add_column(
        "work_orders",
        sa.Column("pieces_data", sa.Text(), nullable=True),
    )
    op.add_column(
        "materials",
        sa.Column(
            "allows_integrated_sink",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("1"),
        ),
    )


def downgrade() -> None:
    op.drop_column("materials", "allows_integrated_sink")
    op.drop_column("work_orders", "pieces_data")
    op.drop_column("budgets", "pieces_data")