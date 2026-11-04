"""Add per-work-order pool requirements and allocation history.

Additive only. Existing work orders and stock movements intentionally remain
unlinked; new rows use the requirement relation for partial allocation and
explicit recovery auditing.
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "o5p6q7r8s9t0"
down_revision: str | None = "n4o5p6q7r8s9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _table_exists(name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(name)


def _column_exists(table: str, column: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return any(item["name"] == column for item in inspector.get_columns(table))


def upgrade() -> None:
    if not _table_exists("work_order_pool_requirements"):
        op.create_table(
            "work_order_pool_requirements",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "work_order_id",
                sa.Integer(),
                sa.ForeignKey("work_orders.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("work_order_number", sa.String(length=20), nullable=False),
            sa.Column(
                "pool_id",
                sa.Integer(),
                sa.ForeignKey("pool_stock.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("pool_key", sa.String(length=255), nullable=False),
            sa.Column("pool_snapshot", sa.Text(), nullable=True),
            sa.Column("required_quantity", sa.Integer(), nullable=False),
            sa.Column("allocated_quantity", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("recovered_quantity", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("unrecovered_quantity", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="OPEN"),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
            sa.UniqueConstraint(
                "work_order_id",
                "pool_key",
                name="uq_work_order_pool_requirement_key",
            ),
        )
        op.create_index(
            "ix_work_order_pool_requirements_work_order_id",
            "work_order_pool_requirements",
            ["work_order_id"],
        )
        op.create_index(
            "ix_work_order_pool_requirements_pool_id",
            "work_order_pool_requirements",
            ["pool_id"],
        )

    if not _column_exists("stock_movements", "requirement_id"):
        # SQLite no soporta ADD COLUMN con FK standalone; alli se usa batch
        # (recrea la tabla). En MySQL, recreate="always" crea una tabla
        # temporal mientras la original existe y choca por nombre de FK
        # duplicado (error 1826), por eso se usa ALTER TABLE directo.
        column = sa.Column(
            "requirement_id",
            sa.Integer(),
            sa.ForeignKey(
                "work_order_pool_requirements.id",
                ondelete="SET NULL",
                name="fk_stock_movements_requirement_id",
            ),
            nullable=True,
        )
        if op.get_bind().dialect.name == "sqlite":
            with op.batch_alter_table("stock_movements", recreate="always") as batch:
                batch.add_column(column)
        else:
            op.add_column("stock_movements", column)
        op.create_index(
            "ix_stock_movements_requirement_id",
            "stock_movements",
            ["requirement_id"],
        )


def downgrade() -> None:
    if _column_exists("stock_movements", "requirement_id"):
        op.drop_index("ix_stock_movements_requirement_id", table_name="stock_movements")
        if op.get_bind().dialect.name == "sqlite":
            with op.batch_alter_table("stock_movements", recreate="always") as batch:
                batch.drop_column("requirement_id")
        else:
            op.drop_column("stock_movements", "requirement_id")
    if _table_exists("work_order_pool_requirements"):
        op.drop_index(
            "ix_work_order_pool_requirements_pool_id",
            table_name="work_order_pool_requirements",
        )
        op.drop_index(
            "ix_work_order_pool_requirements_work_order_id",
            table_name="work_order_pool_requirements",
        )
        op.drop_table("work_order_pool_requirements")
