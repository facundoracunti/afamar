"""Add semantic front kind to the additional-works catalogue.

The backfill is deliberately conservative: it classifies the exact canonical
name only when there is exactly one matching ``frente`` row. Ambiguous or
missing catalogue data remains NULL for an operator to resolve explicitly.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "p6q7r8s9t0u1"
down_revision: str | None = "o5p6q7r8s9t0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _column_exists(table: str, column: str) -> bool:
    return any(
        item["name"] == column
        for item in sa.inspect(op.get_bind()).get_columns(table)
    )


def upgrade() -> None:
    if not _column_exists("additional_works", "front_kind"):
        op.add_column(
            "additional_works",
            sa.Column("front_kind", sa.String(length=30), nullable=True),
        )

    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            "SELECT id FROM additional_works "
            "WHERE name = :name AND type = :type"
        ),
        {"name": "Frente Ingletetado 45°", "type": "frente"},
    ).fetchall()
    if len(rows) == 1:
        bind.execute(
            sa.text("UPDATE additional_works SET front_kind = :kind WHERE id = :id"),
            {"kind": "MITER_45", "id": rows[0][0]},
        )


def downgrade() -> None:
    if _column_exists("additional_works", "front_kind"):
        op.drop_column("additional_works", "front_kind")
