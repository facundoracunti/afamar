"""add adicionales table (catalogue of reusable add-on items)

Revision ID: d3e4f5a6b7c9
Revises: c2d3e4f5a6b8
Create Date: 2026-07-08 23:30:00.000000

Adds the `adicionales` catalogue used by the budget/work-order form
to render "DETALLE DE FABRICACIÓN Y ACCESORIOS COMUNES". Single price
column whose value lives in the currency of the `currency_id` FK
(same convention as `pool_stock` after the Ola 4 currencies
migration). `is_active` + `sort_order` let the operator disable
items without deleting the row and control the display order in the
catalog picker.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd3e4f5a6b7c9'
down_revision: Union[str, None] = 'c2d3e4f5a6b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'adicionales',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('detail', sa.Text(), nullable=True),
        sa.Column('price', sa.Float(), nullable=False, server_default=sa.text('0')),
        sa.Column('currency_id', sa.Integer(), nullable=False, server_default=sa.text('1')),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.ForeignKeyConstraint(
            ['currency_id'], ['currencies.id'],
            name='fk_adicionales_currency_id_currencies',
            ondelete='RESTRICT',
        ),
    )
    op.create_index('ix_adicionales_id', 'adicionales', ['id'])
    op.create_index('ix_adicionales_currency_id', 'adicionales', ['currency_id'])
    op.create_index('ix_adicionales_is_active', 'adicionales', ['is_active'])
    op.create_index('ix_adicionales_sort_order', 'adicionales', ['sort_order'])


def downgrade() -> None:
    op.drop_index('ix_adicionales_sort_order', table_name='adicionales')
    op.drop_index('ix_adicionales_is_active', table_name='adicionales')
    op.drop_index('ix_adicionales_currency_id', table_name='adicionales')
    op.drop_index('ix_adicionales_id', table_name='adicionales')
    op.drop_table('adicionales')
