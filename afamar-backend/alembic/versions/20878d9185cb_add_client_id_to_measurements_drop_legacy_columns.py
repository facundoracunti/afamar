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
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column['name'] for column in inspector.get_columns('measurements')}
    legacy_columns = {
        column for column in ('client_name', 'client_address', 'client_phone')
        if column in columns
    }
    index_name = op.f('ix_measurements_client_id')
    indexes = {index['name'] for index in inspector.get_indexes('measurements')}
    foreign_keys = inspector.get_foreign_keys('measurements')
    has_client_fk = any(
        fk.get('referred_table') == 'clients'
        and fk.get('constrained_columns') == ['client_id']
        for fk in foreign_keys
    )

    if bind.dialect.name == 'sqlite':
        with op.batch_alter_table('measurements', recreate='always') as batch_op:
            if 'client_id' not in columns:
                batch_op.add_column(sa.Column('client_id', sa.Integer(), nullable=True))
            if index_name not in indexes:
                batch_op.create_index(index_name, ['client_id'], unique=False)
            if not has_client_fk:
                batch_op.create_foreign_key(
                    'fk_measurements_client_id',
                    'clients',
                    ['client_id'],
                    ['id'],
                    ondelete='SET NULL',
                )
            for column in legacy_columns:
                batch_op.drop_column(column)
        return

    if 'client_id' not in columns:
        op.add_column('measurements', sa.Column('client_id', sa.Integer(), nullable=True))
    if index_name not in indexes:
        op.create_index(index_name, 'measurements', ['client_id'], unique=False)
    if not has_client_fk:
        op.create_foreign_key(
            'fk_measurements_client_id',
            'measurements',
            'clients',
            ['client_id'],
            ['id'],
            ondelete='SET NULL',
        )
    for column in legacy_columns:
        op.drop_column('measurements', column)


def downgrade() -> None:
    op.add_column('measurements', sa.Column('client_phone', mysql.VARCHAR(length=50), nullable=True))
    op.add_column('measurements', sa.Column('client_address', mysql.TEXT(), nullable=True))
    op.add_column('measurements', sa.Column('client_name', mysql.VARCHAR(length=200), nullable=True))
    op.drop_constraint(None, 'measurements', type_='foreignkey')
    op.drop_index(op.f('ix_measurements_client_id'), table_name='measurements')
    op.drop_column('measurements', 'client_id')
