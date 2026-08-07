"""Link materials to the `material_colors` catalogue via a `color_id` FK.

Replaces the legacy free-text `materials.color` column (which held values
like `BLANCO`, `blanco ` or `BEIGE CON VETAS`) with a real FK. The backfill
replicates the current state exactly:

  - color values are normalized (UPPER + TRIM) so case/trailing-space
    variants collapse to a single catalogue entry;
  - values already in the catalogue (case-insensitive match) are linked
    to the existing row;
  - any value missing from the catalogue is inserted with its canonical
    Title Case name and linked.

On the production database at migration time this yielded 20 normalized
colors: 7 matched the existing 11-row catalogue, 13 were inserted, and
all 60 materials ended up with a `color_id`.

Revision ID: f6a2c9d4e1b8
Revises: 11e4cc1657da
Create Date: 2026-08-06
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f6a2c9d4e1b8"
down_revision: Union[str, None] = "11e4cc1657da"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _normalize(value: str) -> str:
    """Upper + trim so `BLANCO` / `blanco ` / ` BLANCO ` collapse to one."""
    return value.strip().upper()


def _canonical_name(value: str) -> str:
    """Title Case with only the first word capitalized (e.g. `Beige con vetas`)."""
    return value.strip().lower().capitalize()


def _existing_color_id(normalized: str):
    """Find a catalogue row matching the normalized value (case-insensitive)."""
    return op.get_bind().execute(
        sa.text("SELECT id FROM material_colors WHERE UPPER(TRIM(name)) = :name"),
        {"name": normalized},
    ).scalar()


def _insert_color(name: str) -> int:
    """Insert a catalogue color and return its new id."""
    op.execute(sa.text("INSERT INTO material_colors (name) VALUES (:name)"), {"name": name})
    return op.get_bind().execute(
        sa.text("SELECT id FROM material_colors WHERE name = :name"),
        {"name": name},
    ).scalar()


def upgrade() -> None:
    op.add_column("materials", sa.Column("color_id", sa.Integer(), nullable=True))
    op.create_index("ix_materials_color_id", "materials", ["color_id"])

    bind = op.get_bind()
    distinct = bind.execute(
        sa.text(
            "SELECT DISTINCT color FROM materials "
            "WHERE color IS NOT NULL AND LENGTH(TRIM(color)) > 0"
        )
    ).fetchall()

    for (raw,) in distinct:
        normalized = _normalize(raw)
        color_id = _existing_color_id(normalized)
        if color_id is None:
            color_id = _insert_color(_canonical_name(raw))
        op.execute(
            sa.text(
                "UPDATE materials SET color_id = :cid "
                "WHERE color IS NOT NULL AND UPPER(TRIM(color)) = :name"
            ),
            {"cid": color_id, "name": normalized},
        )

    op.drop_column("materials", "color")


def downgrade() -> None:
    op.add_column("materials", sa.Column("color", sa.String(length=100), nullable=True))
    op.execute(
        sa.text(
            "UPDATE materials SET color = "
            "(SELECT name FROM material_colors WHERE id = materials.color_id)"
        )
    )
    op.drop_index("ix_materials_color_id", table_name="materials")
    op.drop_column("materials", "color_id")
