# `tests/` — pytest suite, ad-hoc ops scripts, end-to-end smoke tests

This folder is the **single home** for everything test-shaped in the
backend:

* `conftest.py` + future `test_*.py` files → the formal pytest suite.
* Maintenance / diagnostic scripts (one-shot DDL, data migration,
  schema audit, cleanup) → run by hand against a live DB.
* End-to-end smoke tests → run by hand against a live API+DB to verify
  a complete flow works (e.g. "does budget → WO conversion still
  carry the croquis?").

The pytest collector ignores the maintenance + smoke scripts because
none of them match the `test_*.py` / `*_test.py` pattern. They all
have `if __name__ == "__main__":` guards and a `main()` entry point, so
you can run them as plain Python scripts without pytest getting in
the way.

## Maintenance / diagnostic scripts

| Script | What it does | When to run it |
|---|---|---|
| `audit_schema_drift.py` | Lists every table column whose name still contains a Spanish word (e.g. `nombre`, `fecha`, `precio`). The codebase is supposed to be English-only; this is the smoke test for accidental drift. | After a refactor that touched the ORM models, before committing. |
| `cleanup_test_data.py` | Hard-deletes the `price_history` row left behind by the material-update API smoke test (material id 106). | After running the material price update test. |
| `migrate_old_data.py` | One-shot data migration from the legacy Spanish-schema DB to the new English tables. The Alembic migrations already created the empty new tables; this script copies the data across. Has `--dry-run` and `--drop-old` flags. | Once, on the first deploy from the old Spanish schema. Idempotent in dry-run mode. |
| `apply_term_overrides_migration.py` | One-shot DDL for the per-entity term-override columns (`budget_terms_override`, `warranty_override`, `delivery_terms_override`). Idempotent — skips columns that already exist. | Once, on the MySQL deploy that needed these columns before Alembic picked them up. **No-op on a fresh DB** because the equivalent Alembic migration now exists. |

## Smoke / end-to-end scripts

These hit the live API to verify a complete flow works. Useful when
debugging a bug report or before a deploy.

| Script | What it verifies |
|---|---|
| `smoke_croquis_budget_to_wo.py` | End-to-end: creates a budget with a 2-element croquis, approves it, converts to a work order, and checks the WO's `sketch_elements` round-trips with both elements intact. The classic "I drew in the budget but the WO is blank" regression. |
| `smoke_budget_date.py` | Round-trips several candidate dates through POST/GET `/api/v1/budgets` to verify the date wire format doesn't shift across the UTC boundary. The "el presupuesto se guardó en 7/7 pero hoy es 8" regression. |

## Usage

All scripts expect to be run from the backend root (`afamar-backend/`)
with the venv activated AND the API running on `localhost:3095` (for
the smoke ones), e.g.:

```bash
cd afamar-backend
.\venv\Scripts\Activate.ps1
python tests/audit_schema_drift.py
python tests/cleanup_test_data.py
python tests/apply_term_overrides_migration.py
python tests/migrate_old_data.py --dry-run   # then without --dry-run once happy
python tests/smoke_croquis_budget_to_wo.py  # needs the API up
python tests/smoke_budget_date.py          # needs the API up
```

The `app.*` imports in these scripts rely on `sys.path.insert(0, ".")`
in the seeders pattern (and on the fact that `afamar-backend/` is the
cwd) — same convention as `scripts/`.

To run the (future) pytest suite:

```bash
cd afamar-backend
.\venv\Scripts\Activate.ps1
pytest tests/                 # auto-discovers test_*.py / *_test.py
```

## What's NOT here

* Production seeders (users, materials, settings, etc.) → `../scripts/`
* Alembic migrations → `../alembic/versions/`
