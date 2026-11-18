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
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    is_sqlite = bind.dialect.name == 'sqlite'

    if 'pool_types' not in tables:
        op.create_table(
            'pool_types',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=50), nullable=False),
            sa.Column('label', sa.String(length=100), nullable=False),
            sa.Column(
                'created_at',
                sa.DateTime(),
                server_default=sa.text(
                    'CURRENT_TIMESTAMP' if is_sqlite else 'now()'
                ),
                nullable=False,
            ),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('name'),
        )

    indexes = {index['name'] for index in inspector.get_indexes('pool_types')}
    if op.f('ix_pool_types_id') not in indexes:
        op.create_index(op.f('ix_pool_types_id'), 'pool_types', ['id'], unique=False)

    pool_stock_columns = {
        column['name'] for column in inspector.get_columns('pool_stock')
    }
    if 'pool_type_id' not in pool_stock_columns:
        op.add_column(
            'pool_stock',
            sa.Column('pool_type_id', sa.Integer(), nullable=True),
        )

    foreign_keys = inspector.get_foreign_keys('pool_stock')
    has_pool_type_fk = any(
        fk.get('name') == 'fk_pool_stock_pool_type'
        for fk in foreign_keys
    )
    if not has_pool_type_fk:
        if is_sqlite:
            with op.batch_alter_table('pool_stock', recreate='always') as batch_op:
                batch_op.create_foreign_key(
                    'fk_pool_stock_pool_type',
                    'pool_types',
                    ['pool_type_id'],
                    ['id'],
                )
        else:
            op.create_foreign_key(
                'fk_pool_stock_pool_type',
                'pool_stock',
                'pool_types',
                ['pool_type_id'],
                ['id'],
            )


def downgrade() -> None:
    op.drop_constraint('fk_pool_stock_pool_type', 'pool_stock', type_='foreignkey')
    op.drop_column('pool_stock', 'pool_type_id')
    op.drop_index(op.f('ix_pool_types_id'), table_name='pool_types')
    op.drop_table('pool_types')
