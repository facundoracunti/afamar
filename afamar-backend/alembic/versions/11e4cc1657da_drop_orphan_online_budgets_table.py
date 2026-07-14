"""drop_orphan_online_budgets_table

Revision ID: 11e4cc1657da
Revises: ad4d5e6f7g8a
Create Date: 2026-07-14 08:54:46.587909
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '11e4cc1657da'
down_revision: Union[str, None] = 'ad4d5e6f7g8a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index(op.f('ix_online_budgets_id'), table_name='online_budgets')
    op.drop_index(op.f('number'), table_name='online_budgets')
    op.drop_table('online_budgets')


def downgrade() -> None:
    op.create_table(
        'online_budgets',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('number', sa.String(20), nullable=False),
        sa.Column('client_name', sa.String(200), nullable=True),
        sa.Column('phone', sa.String(50), nullable=True),
        sa.Column('work_type', sa.String(200), nullable=True),
        sa.Column('date', sa.String(50), nullable=True),
        sa.Column('status', sa.String(30), nullable=False),
        sa.Column('usd_rate', sa.Float, nullable=False),
        sa.Column('items_data', sa.Text, nullable=True),
        sa.Column('total_net_ars', sa.Float, nullable=False),
        sa.Column('total_net_usd', sa.Float, nullable=False),
        sa.Column('total_consolidated', sa.Float, nullable=False),
        sa.Column('pool_id', sa.Integer, sa.ForeignKey('pool_stock.id'), nullable=True),
        sa.Column('pool_price', sa.Float, nullable=False),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    op.create_index(op.f('number'), 'online_budgets', ['number'], unique=True)
    op.create_index(op.f('ix_online_budgets_id'), 'online_budgets', ['id'], unique=False)
