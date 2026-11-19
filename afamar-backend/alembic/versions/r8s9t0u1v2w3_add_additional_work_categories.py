"""add editable additional work categories

Revision ID: r8s9t0u1v2w3
Revises: q7r8s9t0u1v2
"""

from alembic import op
import sqlalchemy as sa

revision = "r8s9t0u1v2w3"
down_revision = "q7r8s9t0u1v2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "additional_work_categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=80), nullable=False, unique=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    bind = op.get_bind()
    legacy = {
        "pools": "Piletas y traforos",
        "cuts": "Cortes y frentes",
        "connections": "Conexiones e instalaciones",
        "equipment": "Accesorios y equipamiento",
        "other": "Otros",
    }
    values = [row[0] for row in bind.execute(sa.text("SELECT DISTINCT category FROM additional_works WHERE category IS NOT NULL AND category <> ''"))]
    names = list(dict.fromkeys([legacy.get(value, value) for value in values] + list(legacy.values())))
    for order, name in enumerate(names):
        bind.execute(sa.text("INSERT INTO additional_work_categories (name, sort_order, active) VALUES (:name, :sort_order, 1)"), {"name": name, "sort_order": order})
    for old, new in legacy.items():
        bind.execute(sa.text("UPDATE additional_works SET category = :new WHERE category = :old"), {"old": old, "new": new})


def downgrade() -> None:
    op.drop_table("additional_work_categories")
