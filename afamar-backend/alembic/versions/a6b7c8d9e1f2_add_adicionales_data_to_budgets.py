"""add adicionales_data column to budgets

Revision ID: a6b7c8d9e1f2
Revises: f5a6b7c8d9e1
Create Date: 2026-07-08 21:20:00.000000

Adds the `adicionales_data` TEXT column to `budgets` so the budget
form can persist the JSON snapshot of selected items from the
`adicionales` catalogue. Mirrors the same column on `work_orders`
so the convert-to-WO flow can copy the value across without
re-encoding. The legacy `BudgetAdicional` 1-N table is left in
place (its rows are read by `create_from_budget` as a fallback when
`adicionales_data` is empty).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a6b7c8d9e1f2'
down_revision: Union[str, None] = 'f5a6b7c8d9e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('budgets', sa.Column('adicionales_data', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('budgets', 'adicionales_data')
