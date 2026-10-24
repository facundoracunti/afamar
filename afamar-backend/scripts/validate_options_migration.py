"""Validate the options_data migration on a throwaway SQLite DB.

Run from `afamar-backend/` with PYTHONPATH=. :
    python scripts/validate_options_migration.py

The full alembic chain can't run from zero on SQLite (a pre-existing
MySQL-only `DROP FOREIGN KEY` in an old revision), so this loads ONLY
the new migration module and exercises upgrade() → re-run → downgrade()
against a hand-built `budgets` table that has the pre-migration columns.
Same technique used to validate j0k1l2m3n4o5.
"""
import importlib.util
import os
import pathlib
import sys

from sqlalchemy import create_engine, inspect, text
from alembic.migration import MigrationContext
from alembic.operations import Operations

BACKEND = pathlib.Path(__file__).resolve().parents[1]
MIGRATION = BACKEND / "alembic" / "versions" / "k1l2m3n4o5p6_add_budget_options_data.py"

sys.path.insert(0, str(BACKEND))

engine = create_engine("sqlite://")
# One connection held open for the whole script: `Operations` binds to a
# connection, so it must outlive each individual `op.*` call.
conn = engine.connect()
with conn.begin():
    conn.execute(text(
        "CREATE TABLE budgets ("
        " id INTEGER PRIMARY KEY,"
        " number VARCHAR(30),"
        " total FLOAT"
        ")"
    ))
    conn.execute(text("INSERT INTO budgets (id, number, total) VALUES (1, 'P-000001', 1000)"))
conn.commit()


def load_module():
    spec = importlib.util.spec_from_file_location("mig_options", MIGRATION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.op = Operations(MigrationContext.configure(conn))
    return module


def columns():
    return {c["name"] for c in inspect(conn).get_columns("budgets")}


mod = load_module()

# 1. upgrade
mod.upgrade()
assert "options_data" in columns(), columns()
print("upgrade OK -> options_data present")

# 2. idempotent re-run
mod.upgrade()
assert "options_data" in columns()
print("idempotent re-run OK")

# 3. pre-existing row untouched (NULL = legacy single-option)
row = conn.execute(text("SELECT number, options_data FROM budgets WHERE id = 1")).fetchone()
assert row[0] == "P-000001"
assert row[1] is None, f"legacy row should keep options_data NULL, got {row[1]!r}"
print(f"legacy row untouched OK -> options_data={row[1]!r}")

# 4. write + read a real multi-option payload
payload = (
    '[{"id":"opt-1","name":"Opcion 1","is_selected":true,'
    '"pieces":[{"id":"p1","name":"COCINA"}],"subtotal_ars":1250000.0}]'
)
conn.execute(text("UPDATE budgets SET options_data = :v WHERE id = 1"), {"v": payload})
conn.commit()
from app.services.budget_options import resolve_budget_options  # noqa: E402

stored = conn.execute(text("SELECT options_data FROM budgets WHERE id = 1")).scalar_one()
options = resolve_budget_options(stored, None)
assert len(options) == 1
assert options[0]["id"] == "opt-1"
assert options[0]["name"] == "Opcion 1"
assert options[0]["is_selected"] is True
assert options[0]["pieces"][0]["name"] == "COCINA"
assert options[0]["subtotal_ars"] == 1250000.0
print("round-trip OK -> 1 option parsed with its pieces")

# 5. downgrade
mod.downgrade()
assert "options_data" not in columns(), columns()
print("downgrade OK -> options_data dropped")

# 6. downgrade is also idempotent
mod.downgrade()
assert "options_data" not in columns()
print("idempotent downgrade OK")

conn.close()
print("\nMIGRATION OK (upgrade + idempotent + legacy-row-untouched + round-trip + downgrade)")
# Alembic's `op` leaves non-daemon threads behind on the SQLite driver;
# flush explicitly (os._exit skips the buffer) then hard-exit.
import sys as _sys  # noqa: E402

_sys.stdout.flush()
_sys.stderr.flush()
os._exit(0)