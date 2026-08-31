"""add include_measurement_comparison_in_pdf to work_orders

Per-order flag controlling whether the "COMPARATIVA DE MEDICIÓN" table
(Concepto | M² Real | M² Presupuestado | Diferencia) is printed in the
work order PDF. The table already lives in the form (FabricationSection)
and is now lifted into both PDF builders (frontend `DocumentPdf` +
legacy backend `pdf_html.py`); this column lets the operator hide or
show it per order.

- `include_measurement_comparison_in_pdf` (BOOLEAN, NOT NULL):
  defaults to `1` (true) so existing orders keep printing the table
  unless the operator opts out.

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-08-29 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e6f7a8b9c0d1"
down_revision: Union[str, None] = "d5e6f7a8b9c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "work_orders",
        sa.Column(
            "include_measurement_comparison_in_pdf",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("1"),
        ),
    )


def downgrade() -> None:
    op.drop_column("work_orders", "include_measurement_comparison_in_pdf")
