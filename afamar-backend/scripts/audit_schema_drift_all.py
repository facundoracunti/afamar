"""Schema drift audit: compare every ORM table against the live DB.

Reports missing/extra columns so a phpMyAdmin drop+recreate can be fixed
in one pass instead of chasing 500s one endpoint at a time. Read-only.
"""
from sqlalchemy import create_engine, inspect

import app.models  # noqa: F401  (register all mappers on Base.metadata)
from app.core.settings import settings
from app.db.base import Base

engine = create_engine(settings.DATABASE_URL)
inspector = inspect(engine)

problems = 0
for table in Base.metadata.sorted_tables:
    tname = table.name
    if tname not in inspector.get_table_names():
        print(f"[FALTA TABLA] {tname}")
        problems += 1
        continue
    actual = {c["name"] for c in inspector.get_columns(tname)}
    model = {c.name for c in table.columns}
    missing = sorted(model - actual)
    extra = sorted(actual - model)
    if missing or extra:
        problems += 1
        print(f"[{tname}]")
        if missing:
            print(f"   FALTAN: {missing}")
        if extra:
            print(f"   SOBRAN: {extra}")

print("---")
print("tablas con drift:", problems)