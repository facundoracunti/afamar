"""add work_order_id to measurements

Revision ID: 9f3a1b2c4d5e
Revises: 248a1a9b051b
Create Date: 2026-07-06 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '9f3a1b2c4d5e'
down_revision: Union[str, None] = '248a1a9b051b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('measurements', schema=None) as batch_op:
        batch_op.add_column(sa.Column('work_order_id', sa.Integer(), nullable=True))
        batch_op.create_index('ix_measurements_work_order_id', ['work_order_id'], unique=False)
        batch_op.create_foreign_key(
            'fk_measurements_work_order_id_work_orders',
            'work_orders',
            ['work_order_id'],
            ['id'],
            ondelete='SET NULL',
        )


def downgrade() -> None:
    with op.batch_alter_table('measurements', schema=None) as batch_op:
        batch_op.drop_constraint('fk_measurements_work_order_id_work_orders', type_='foreignkey')
        batch_op.drop_index('ix_measurements_work_order_id')
        batch_op.drop_column('work_order_id')
