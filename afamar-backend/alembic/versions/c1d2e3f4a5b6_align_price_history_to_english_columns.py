"""Bring `price_history` columns in sync with the SQLAlchemy model.

The model's English column names (`material_name`, `price_m2`, `date`)
are the canonical schema. Some legacy MySQL deployments were created
with the original Spanish names (`material_nombre`, `precio_m2`,
`fecha`) and never had the English columns added — leading to
`OperationalError` on any insert that goes through the ORM (e.g.
material create / update on price change, the seeder, etc.).

This migration makes the schema match the model in an idempotent way,
using raw SQL because Alembic's `op.alter_column(... new_column_name=)`
requires a precise existing_type per MySQL's CHANGE COLUMN syntax and
the type reported by the inspector is not always the exact DDL string.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, None] = "b1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (english_name, english_ddl_for_add, spanish_legacy_name, spanish_ddl_for_add)
# When the Spanish column exists, it's renamed. When the English column is
# also missing and there is no Spanish column either, the English column is
# added from scratch using the DDL below.
_RENAMES: tuple[tuple[str, str, str | None, str | None], ...] = (
    ("material_name", "VARCHAR(200) NULL", "material_nombre", "VARCHAR(255) NULL"),
    ("price_m2",      "FLOAT NULL",       "precio_m2",      "FLOAT NULL"),
    ("date",          "DATETIME NULL",    "fecha",          "DATETIME NULL"),
)


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return column in {c["name"] for c in insp.get_columns(table)}


def upgrade() -> None:
    for english_name, english_ddl, spanish_name, spanish_ddl in _RENAMES:
        if _column_exists("price_history", english_name):
            continue
        if spanish_name and _column_exists("price_history", spanish_name):
            # Rename via CHANGE COLUMN so any legacy data is preserved.
            op.execute(
                f"ALTER TABLE price_history "
                f"CHANGE COLUMN `{spanish_name}` `{english_name}` {english_ddl}"
            )
        else:
            op.execute(
                f"ALTER TABLE price_history ADD COLUMN `{english_name}` {english_ddl}"
            )


def downgrade() -> None:
    for english_name, _english_ddl, spanish_name, _spanish_ddl in _RENAMES:
        if spanish_name and _column_exists("price_history", english_name) and not _column_exists("price_history", spanish_name):
            op.execute(
                f"ALTER TABLE price_history "
                f"CHANGE COLUMN `{english_name}` `{spanish_name}` "
                f"{('VARCHAR(200)' if english_name == 'material_name' else 'FLOAT' if english_name == 'price_m2' else 'DATETIME')} NULL"
            )
