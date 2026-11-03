"""Persist the immutable commercial breakdown for measurement approvals.

The column is nullable so approvals created before this feature remain valid
and can continue using their aggregate totals and measurement snapshot.
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "m3n4o5p6q7r8"
down_revision: str | None = "l2m3n4o5p6q7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "work_order_measurement_approvals",
        sa.Column("approval_breakdown", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("work_order_measurement_approvals", "approval_breakdown")
