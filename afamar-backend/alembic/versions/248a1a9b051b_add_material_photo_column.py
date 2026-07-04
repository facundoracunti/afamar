"""add material photo column

Revision ID: 248a1a9b051b
Revises: b1d663f9c2bd
Create Date: 2026-07-04 16:23:04.622337
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '248a1a9b051b'
down_revision: Union[str, None] = 'b1d663f9c2bd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('materials', sa.Column('photo', sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column('materials', 'photo')
