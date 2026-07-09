"""drop sort_order from adicionales

Revision ID: f5a6b7c8d9e1
Revises: e4f5a6b7c8d0
Create Date: 2026-07-08 21:30:00.000000

Drops the `sort_order` column from `adicionales`. Originally added so
the operator could control the display order in the budget picker.
The user decided alphabetical / creation order is enough — the picker
will sort by name.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f5a6b7c8d9e1'
down_revision: Union[str, None] = 'e4f5a6b7c8d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index('ix_adicionales_sort_order', table_name='adicionales')
    op.drop_column('adicionales', 'sort_order')


def downgrade() -> None:
    op.add_column(
        'adicionales',
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default=sa.text('0')),
    )
    op.create_index('ix_adicionales_sort_order', 'adicionales', ['sort_order'])
