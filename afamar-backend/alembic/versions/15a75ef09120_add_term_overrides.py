"""add per-budget and per-work-order term overrides

Revision ID: 15a75ef09120
Revises: 536b175b6af0
Create Date: 2026-07-03 12:56:03.663990
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '15a75ef09120'
down_revision: Union[str, None] = '536b175b6af0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add only the term-overrides columns. Per-budget/per-work-order terms are
    # stored as a JSON list (string column) and may be empty (inherit global).
    op.add_column('budgets', sa.Column('budget_terms_override', sa.Text(), nullable=True))
    op.add_column('budgets', sa.Column('warranty_override', sa.Text(), nullable=True))
    op.add_column('work_orders', sa.Column('delivery_terms_override', sa.Text(), nullable=True))
    op.add_column('work_orders', sa.Column('warranty_override', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('work_orders', 'warranty_override')
    op.drop_column('work_orders', 'delivery_terms_override')
    op.drop_column('budgets', 'warranty_override')
    op.drop_column('budgets', 'budget_terms_override')
