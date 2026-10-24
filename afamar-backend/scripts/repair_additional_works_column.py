"""One-off schema repair: rename the legacy `adicionales_data` column to
`additional_works_data` in `budgets` + `work_orders`.

Context: the database was dropped/recreated from phpMyAdmin and the
`alembic_version` row says head (`j0k1l2m3n4o5`) while the actual table
DDL still carries the pre-`33eba7752f2d` column name. Alembic therefore
skips the rename migration and every query that selects
`budgets.additional_works_data` fails with MySQL 1054.

Idempotent: only renames when the legacy column exists and the new one
doesn't. Safe to re-run.
"""
from sqlalchemy import create_engine, inspect, text

from app.core.settings import settings

TARGETS = ("budgets", "work_orders")
LEGACY = "adicionales_data"
CURRENT = "additional_works_data"

engine = create_engine(settings.DATABASE_URL)
inspector = inspect(engine)

with engine.begin() as conn:
    for table in TARGETS:
        cols = {c["name"] for c in inspector.get_columns(table)}
        if LEGACY not in cols:
            print(f"{table}: '{LEGACY}' no existe — nada que hacer.")
            continue
        if CURRENT in cols:
            print(f"{table}: '{CURRENT}' ya existe — se omite el rename.")
            continue
        conn.execute(
            text(
                f"ALTER TABLE {table} "
                f"CHANGE `{LEGACY}` `{CURRENT}` TEXT DEFAULT NULL"
            )
        )
        print(f"{table}: {LEGACY} -> {CURRENT} OK")

# Verify
inspector = inspect(engine)
with engine.connect() as conn:
    print("--- verificacion ---")
    for table in TARGETS:
        cols = {c["name"] for c in inspector.get_columns(table)}
        has_new = CURRENT in cols
        has_old = LEGACY in cols
        print(
            f"{table}: {CURRENT}={has_new} | {LEGACY}={has_old} | "
            f"columnas={len(cols)}"
        )