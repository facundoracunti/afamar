"""Store explicit commercial approvals for work-order measurement deltas.

Additive only. Existing work orders have no rows and therefore retain their
current frozen commercial values exactly.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "l2m3n4o5p6q7"
down_revision: Union[str, None] = "k1l2m3n4o5p6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "work_order_measurement_approvals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("work_order_id", sa.Integer(), nullable=False),
        sa.Column("approved_by_user_id", sa.Integer(), nullable=False),
        sa.Column("approved_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("previous_total", sa.Float(), nullable=False),
        sa.Column("previous_total_usd", sa.Float(), nullable=False),
        sa.Column("positive_difference_ars", sa.Float(), server_default="0", nullable=False),
        sa.Column("negative_difference_ars", sa.Float(), server_default="0", nullable=False),
        sa.Column("difference_ars", sa.Float(), nullable=False),
        sa.Column("difference_usd", sa.Float(), nullable=False),
        sa.Column("discount_difference_ars", sa.Float(), server_default="0", nullable=False),
        sa.Column("new_total", sa.Float(), nullable=False),
        sa.Column("new_total_usd", sa.Float(), nullable=False),
        sa.Column("usd_rate", sa.Float(), nullable=False),
        sa.Column("measurement_fingerprint", sa.String(64), nullable=False),
        sa.Column("measurement_snapshot", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["work_order_id"], ["work_orders.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["approved_by_user_id"], ["users.id"]),
    )
    op.create_index(
        "ix_work_order_measurement_approvals_work_order_id",
        "work_order_measurement_approvals",
        ["work_order_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_work_order_measurement_approvals_work_order_id",
        table_name="work_order_measurement_approvals",
    )
    op.drop_table("work_order_measurement_approvals")
