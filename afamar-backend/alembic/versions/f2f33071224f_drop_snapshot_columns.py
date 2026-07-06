"""drop snapshot columns

Revision ID: f2f33071224f
Revises: 9f3a1b2c4d5e
Create Date: 2026-07-06 16:29:25.587439
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = 'f2f33071224f'
down_revision: Union[str, None] = '9f3a1b2c4d5e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('budgets', 'snapshot_email')
    op.drop_column('budgets', 'snapshot_address')
    op.drop_column('budgets', 'snapshot_name')
    op.drop_column('budgets', 'snapshot_phone')
    op.drop_column('work_orders', 'snapshot_email')
    op.drop_column('work_orders', 'snapshot_address')
    op.drop_column('work_orders', 'snapshot_name')
    op.drop_column('work_orders', 'snapshot_phone')


def downgrade() -> None:
    op.add_column('work_orders', sa.Column('snapshot_phone', mysql.VARCHAR(length=50), nullable=True))
    op.add_column('work_orders', sa.Column('snapshot_name', mysql.VARCHAR(length=200), nullable=True))
    op.add_column('work_orders', sa.Column('snapshot_address', mysql.TEXT(), nullable=True))
    op.add_column('work_orders', sa.Column('snapshot_email', mysql.VARCHAR(length=200), nullable=True))
    op.add_column('budgets', sa.Column('snapshot_phone', mysql.VARCHAR(length=50), nullable=True))
    op.add_column('budgets', sa.Column('snapshot_name', mysql.VARCHAR(length=200), nullable=True))
    op.add_column('budgets', sa.Column('snapshot_address', mysql.TEXT(), nullable=True))
    op.add_column('budgets', sa.Column('snapshot_email', mysql.VARCHAR(length=200), nullable=True))
