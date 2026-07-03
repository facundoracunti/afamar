"""Final schema-drift cleanup: align DB columns to the English SQLAlchemy model.

The MySQL deployment has accumulated Spanish column names and a Spanish
table that pre-date the English refactor:

  - `price_history` still has `material_nombre` and `fecha` (alongside the
    English `material_name` and `date` columns added by previous
    migrations).
  - `materiales` is a legacy table with Spanish columns. It is not
    referenced by any SQLAlchemy model and contains 0 rows — it can be
    safely dropped.

This migration finishes the alignment:

  - Renames `price_history.fecha` → `date` (and `precio_m2` → `price_m2`
    if it still exists, as a no-op safety net for already-up-to-date DBs).
  - Drops the now-redundant `materiales` table.
  - Drops `price_history.material_nombre` once its data has been copied
    into `material_name`.

All operations are idempotent and safe to re-run.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, None] = "c1d2e3f4a5b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return column in {c["name"] for c in insp.get_columns(table)}


def _table_exists(table: str) -> bool:
    bind = op.get_bind()
    return table in sa.inspect(bind).get_table_names()


def upgrade() -> None:
    # 0) Drop the FK that points `price_history.material_id` at the
    # legacy `materiales` table. The model's FK target is
    # `materials.id`, not `materiales.id`; this constraint would
    # otherwise prevent dropping `materiales` and would also reject
    # inserts to `price_history` once the data lives in `materials`.
    op.execute("ALTER TABLE price_history DROP FOREIGN KEY `price_history_ibfk_1`")

    # 1) `price_history`: copy any legacy Spanish data into the English
    # columns, then drop the Spanish columns. Renames that are already
    # done on a given DB are no-ops.
    if _table_exists("price_history"):
        # fecha → date (preserve data if both exist, else rename)
        if _column_exists("price_history", "fecha") and not _column_exists("price_history", "date"):
            op.execute(
                "ALTER TABLE price_history "
                "CHANGE COLUMN `fecha` `date` DATETIME NULL"
            )
        elif _column_exists("price_history", "fecha") and _column_exists("price_history", "date"):
            op.execute(
                "UPDATE price_history SET `date` = `fecha` WHERE `date` IS NULL AND `fecha` IS NOT NULL"
            )
            op.execute("ALTER TABLE price_history DROP COLUMN `fecha`")

        # precio_m2 → price_m2 (defensive; should already be done)
        if _column_exists("price_history", "precio_m2") and not _column_exists("price_history", "price_m2"):
            op.execute(
                "ALTER TABLE price_history "
                "CHANGE COLUMN `precio_m2` `price_m2` FLOAT NULL"
            )
        elif _column_exists("price_history", "precio_m2") and _column_exists("price_history", "price_m2"):
            op.execute(
                "UPDATE price_history SET `price_m2` = `precio_m2` WHERE `price_m2` IS NULL AND `precio_m2` IS NOT NULL"
            )
            op.execute("ALTER TABLE price_history DROP COLUMN `precio_m2`")

        # material_nombre → material_name
        if _column_exists("price_history", "material_nombre") and not _column_exists("price_history", "material_name"):
            op.execute(
                "ALTER TABLE price_history "
                "CHANGE COLUMN `material_nombre` `material_name` VARCHAR(200) NULL"
            )
        elif _column_exists("price_history", "material_nombre") and _column_exists("price_history", "material_name"):
            op.execute(
                "UPDATE price_history SET `material_name` = `material_nombre` "
                "WHERE `material_name` IS NULL AND `material_nombre` IS NOT NULL"
            )
            op.execute("ALTER TABLE price_history DROP COLUMN `material_nombre`")

    # 2) Drop the legacy `materiales` table (Spanish-named, 0 rows, not
    # referenced by any SQLAlchemy model). The new FK to `materials.id`
    # is added by the next migration.
    if _table_exists("materiales"):
        op.execute("DROP TABLE `materiales`")

    # 3) Recreate the FK from `price_history.material_id` to the
    # canonical `materials.id` (matching the SQLAlchemy model).
    op.execute(
        "ALTER TABLE price_history "
        "ADD CONSTRAINT `price_history_ibfk_1` "
        "FOREIGN KEY (`material_id`) REFERENCES `materials` (`id`)"
    )


def downgrade() -> None:
    """Reverse: recreate `materiales` and the Spanish `price_history` columns."""
    if _table_exists("price_history"):
        if not _column_exists("price_history", "fecha"):
            op.execute("ALTER TABLE price_history ADD COLUMN `fecha` DATETIME NULL")
        if not _column_exists("price_history", "precio_m2"):
            op.execute("ALTER TABLE price_history ADD COLUMN `precio_m2` FLOAT NULL")
        if not _column_exists("price_history", "material_nombre"):
            op.execute("ALTER TABLE price_history ADD COLUMN `material_nombre` VARCHAR(255) NULL")

    if not _table_exists("materiales"):
        op.execute(
            """
            CREATE TABLE `materiales` (
                `id` INT NOT NULL AUTO_INCREMENT,
                `nombre` VARCHAR(255),
                `categoria` VARCHAR(50),
                `color` VARCHAR(255),
                `espesor_disponible` VARCHAR(100),
                `precio_m2` FLOAT,
                `precio_m2_usd` FLOAT,
                `moneda` VARCHAR(5),
                `proveedor` VARCHAR(255),
                `stock_disponible` INT,
                `observaciones` TEXT,
                `created_at` DATETIME,
                PRIMARY KEY (`id`)
            )
            """
        )
