# `test/` — ad-hoc maintenance & diagnostic scripts

One-off scripts kept at hand for the common ops tasks. Distinct from
`../tests/` (which holds the pytest suite and is run by CI). These
scripts are **not** part of the test suite — they're interactive tools
you run by hand against a live database.

## Scripts

| Script | What it does | When to run it |
|---|---|---|
| `audit_schema_drift.py` | Lists every table column whose name still contains a Spanish word (e.g. `nombre`, `fecha`, `precio`). The codebase is supposed to be English-only; this is the smoke test for accidental drift. | After a refactor that touched the ORM models, before committing. |
| `cleanup_test_data.py` | Hard-deletes the `price_history` row left behind by the material-update API smoke test (material id 106). | After running the material price update test. |
| `migrate_old_data.py` | One-shot data migration from the legacy Spanish-schema DB to the new English tables. The Alembic migrations already created the empty new tables; this script copies the data across. Has `--dry-run` and `--drop-old` flags. | Once, on the first deploy from the old Spanish schema. Idempotent in dry-run mode. |
| `apply_term_overrides_migration.py` | One-shot DDL for the per-entity term-override columns (`budget_terms_override`, `warranty_override`, `delivery_terms_override`). Idempotent — skips columns that already exist. | Once, on the MySQL deploy that needed these columns before Alembic picked them up. **No-op on a fresh DB** because the equivalent Alembic migration now exists. |

## Usage

All scripts expect to be run from the backend root (`afamar-backend/`)
with the venv activated, e.g.:

```bash
cd afamar-backend
.\venv\Scripts\Activate.ps1
python test/audit_schema_drift.py
python test/cleanup_test_data.py
python test/apply_term_overrides_migration.py
python test/migrate_old_data.py --dry-run   # then without --dry-run once happy
```

The `app.*` imports in these scripts rely on `sys.path.insert(0, ".")`
in the seeders pattern (and on the fact that `afamar-backend/` is the
cwd) — same convention as `scripts/`.

## What's NOT here

* Pytest tests → `../tests/`
* Production seeders (users, materials, settings, etc.) → `../scripts/`
* Alembic migrations → `../alembic/versions/`
