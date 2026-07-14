"""add type + formula_constant to additional_works

Additive migration. Adds two columns to the existing `additional_works`
catalogue table so catalogue rows can be flagged as `frente` (formula-driven
labor pricing) or `flat` (default, legacy pricing).

The old `flat` rows get the value automatically via `server_default='flat'`
so existing catalogue entries keep behaving as before. Operators can opt
a row into the new formula by editing its `type` from the catalogue UI.

Revision ID: ad4d5e6f7g8a
Revises: 33eba7752f2d
Create Date: 2026-07-14 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'ad4d5e6f7g8a'
down_revision: Union[str, None] = '33eba7752f2d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # `type`: pricing mode for this catalogue entry. 'flat' = price * quantity
    # (legacy); 'frente' = (material.price_m2 * 0.13) + formula_constant times
    # the row's `linear_meters`. New column has a server_default so existing
    # rows backfill automatically to the legacy behaviour.
    op.add_column(
        "additional_works",
        sa.Column(
            "type",
            sa.String(length=50),
            nullable=False,
            server_default="flat",
        ),
    )
    # `formula_constant`: optional override for the `+1.15` baseline in the
    # `frente` formula. Null when not applicable (Flat rows ignore it).
    op.add_column(
        "additional_works",
        sa.Column(
            "formula_constant",
            sa.Float(),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("additional_works", "formula_constant")
    op.drop_column("additional_works", "type")
