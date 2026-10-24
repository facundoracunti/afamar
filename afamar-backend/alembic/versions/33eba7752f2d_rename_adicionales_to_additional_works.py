"""rename adicionales → additional_works and adicionales_data → additional_works_data in budgets + work_orders

Revision ID: 33eba7752f2d
Revises: a6b7c8d9e1f2
Create Date: 2026-07-08 22:45:22.706049
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '33eba7752f2d'
down_revision: Union[str, None] = 'a6b7c8d9e1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Como la tabla additional_works ya se crea con su nombre definitivo, 
    # no necesitamos renombrarla ni renombrar sus índices en esta base de datos limpia.
    pass

def downgrade() -> None:
    # Revert column rename in work_orders
    op.alter_column('work_orders', 'additional_works_data', new_column_name='adicionales_data', existing_type=sa.Text())

    # Revert column rename in budgets
    op.alter_column('budgets', 'additional_works_data', new_column_name='adicionales_data', existing_type=sa.Text())

    # Revert index renames
    op.execute('ALTER TABLE additional_works RENAME INDEX ix_additional_works_id TO ix_adicionales_id')
    op.execute('ALTER TABLE additional_works RENAME INDEX ix_additional_works_currency_id TO ix_adicionales_currency_id')

    # Rename table back: additional_works → adicionales
    op.rename_table('additional_works', 'adicionales')
