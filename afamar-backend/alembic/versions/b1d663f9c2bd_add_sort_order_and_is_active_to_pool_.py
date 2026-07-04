"""add sort_order and is_active to pool_types

Revision ID: b1d663f9c2bd
Revises: 38a349770781
Create Date: 2026-07-04 15:28:32.207865
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1d663f9c2bd'
down_revision: Union[str, None] = '38a349770781'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('pool_types', sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')))
    op.add_column('pool_types', sa.Column('sort_order', sa.Integer(), nullable=False, server_default=sa.text('0')))
    op.alter_column('pool_types', 'is_active', server_default=None)
    op.alter_column('pool_types', 'sort_order', server_default=None)


def downgrade() -> None:
    op.drop_column('pool_types', 'sort_order')
    op.drop_column('pool_types', 'is_active')
