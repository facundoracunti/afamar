"""Complete the material color backfill left partial on production.

`f6a2c9d4e1b8` was applied to some environments when the file only
contained `add_column("color_id")` + `create_index`, so the version got
stamped but the backfill and the `drop_column("color")` never ran. This
revision reconciles those environments idempotently:

  - if `materials.color` no longer exists, nothing to do;
  - otherwise it re-runs the exact backfill from `f6a2c9d4e1b8`
    (normalize UPPER+TRIM, resolve-or-create catalogue rows, link every
    material) and then drops the legacy `color` column.

Fresh databases that already ran the full `f6a2c9d4e1b8` are untouched.

Revision ID: c7d8e9f0a1b2
Revises: f6a2c9d4e1b8
Create Date: 2026-08-06
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c7d8e9f0a1b2"
down_revision: Union[str, None] = "f6a2c9d4e1b8"
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
    bind = op.get_bind()
    columns = {c["name"] for c in sa.inspect(bind).get_columns("materials")}
    if "color" not in columns or "color_id" not in columns:
        return

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
    # No-op: the parent revision f6a2c9d4e1b8 owns the reverse of the backfill.
    pass
