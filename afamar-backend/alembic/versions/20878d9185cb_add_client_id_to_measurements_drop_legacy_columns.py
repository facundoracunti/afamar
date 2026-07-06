"""add client_id to measurements drop client_name client_phone client_address

Revision ID: 20878d9185cb
Revises: f2f33071224f
Create Date: 2026-07-06 16:50:43.529800
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = '20878d9185cb'
down_revision: Union[str, None] = 'f2f33071224f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('measurements', sa.Column('client_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_measurements_client_id'), 'measurements', ['client_id'], unique=False)
    op.create_foreign_key(None, 'measurements', 'clients', ['client_id'], ['id'], ondelete='SET NULL')
    op.drop_column('measurements', 'client_name')
    op.drop_column('measurements', 'client_address')
    op.drop_column('measurements', 'client_phone')


def downgrade() -> None:
    op.add_column('measurements', sa.Column('client_phone', mysql.VARCHAR(length=50), nullable=True))
    op.add_column('measurements', sa.Column('client_address', mysql.TEXT(), nullable=True))
    op.add_column('measurements', sa.Column('client_name', mysql.VARCHAR(length=200), nullable=True))
    op.drop_constraint(None, 'measurements', type_='foreignkey')
    op.drop_index(op.f('ix_measurements_client_id'), table_name='measurements')
    op.drop_column('measurements', 'client_id')
