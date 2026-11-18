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
    bind = op.get_bind()
    existing_columns = {
        column['name'] for column in sa.inspect(bind).get_columns('pool_types')
    }

    added_columns: list[str] = []
    if 'is_active' not in existing_columns:
        op.add_column(
            'pool_types',
            sa.Column(
                'is_active',
                sa.Boolean(),
                nullable=False,
                server_default=sa.text('1'),
            ),
        )
        added_columns.append('is_active')

    if 'sort_order' not in existing_columns:
        op.add_column(
            'pool_types',
            sa.Column(
                'sort_order',
                sa.Integer(),
                nullable=False,
                server_default=sa.text('0'),
            ),
        )
        added_columns.append('sort_order')

    # SQLite does not support this ALTER COLUMN form. The defaults are only
    # needed to backfill existing rows, and leaving them in place is safe for
    # the local development database.
    if bind.dialect.name != 'sqlite':
        for column_name in added_columns:
            op.alter_column('pool_types', column_name, server_default=None)


def downgrade() -> None:
    op.drop_column('pool_types', 'sort_order')
    op.drop_column('pool_types', 'is_active')
