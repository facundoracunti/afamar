"""drop is_active from adicionales

Revision ID: e4f5a6b7c8d0
Revises: d3e4f5a6b7c9
Create Date: 2026-07-08 21:00:00.000000

Drops the `is_active` column from `adicionales`. Originally added as a
soft-delete flag so the operator could disable an item without losing
the historical link from existing budgets. The user decided the
basic CRUD is enough — items get hard-deleted when no longer in use
(the budget's `adicionales_data` JSON snapshot keeps the historical
display intact).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e4f5a6b7c8d0'
down_revision: Union[str, None] = 'd3e4f5a6b7c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index('ix_adicionales_is_active', table_name='adicionales')
    op.drop_column('adicionales', 'is_active')


def downgrade() -> None:
    op.add_column(
        'adicionales',
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')),
    )
    op.create_index('ix_adicionales_is_active', 'adicionales', ['is_active'])
