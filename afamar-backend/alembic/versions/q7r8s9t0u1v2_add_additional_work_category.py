"""add category to additional works

Revision ID: q7r8s9t0u1v2
Revises: p6q7r8s9t0u1
"""

from alembic import op
import sqlalchemy as sa

revision = "q7r8s9t0u1v2"
down_revision = "p6q7r8s9t0u1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("additional_works", sa.Column("category", sa.String(length=40), server_default="other", nullable=False))


def downgrade() -> None:
    op.drop_column("additional_works", "category")
