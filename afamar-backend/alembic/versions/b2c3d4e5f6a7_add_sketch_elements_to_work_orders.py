"""add sketch_elements column to work_orders

Revision ID: b2c3d4e5f6a7
Revises: a1c2b3d4e5f7
Create Date: 2026-07-08 16:30:00.000000

Adds a dedicated `work_orders.sketch_elements` TEXT column so the croquis
drawn on the source budget survives the conversion to a work order.

Previously the sketch was stashed into `budgeted_details` (a TEXT column
used for fabrication details) which broke the modern PDF renderer (it
reads `sketch_elements` directly from the API response) — only the
legacy xhtml2pdf path worked, and only because it fell back to
`budgeted_details` for the sketch source.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1c2b3d4e5f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'work_orders',
        sa.Column('sketch_elements', sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('work_orders', 'sketch_elements')
