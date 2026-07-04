"""add pool_types table and pool_type_id to pool_stock

Revision ID: 38a349770781
Revises: d1e2f3a4b5c6
Create Date: 2026-07-04 15:22:07.083015
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = '38a349770781'
down_revision: Union[str, None] = 'd1e2f3a4b5c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('pool_types',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('label', sa.String(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_pool_types_id'), 'pool_types', ['id'], unique=False)
    op.add_column('pool_stock', sa.Column('pool_type_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_pool_stock_pool_type', 'pool_stock', 'pool_types', ['pool_type_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_pool_stock_pool_type', 'pool_stock', type_='foreignkey')
    op.drop_column('pool_stock', 'pool_type_id')
    op.drop_index(op.f('ix_pool_types_id'), table_name='pool_types')
    op.drop_table('pool_types')
