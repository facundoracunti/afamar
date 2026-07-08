"""Audit all DB tables for Spanish column names (schema drift detector)."""
from sqlalchemy import create_engine, inspect
from app.core.settings import settings

SPANISH_WORDS = (
    "nombre", "fecha", "precio", "cantidad", "telefono",
    "direccion", "cliente", "observaciones", "estado",
    "color", "categoria", "espesor",
)


def main() -> None:
    engine = create_engine(settings.DATABASE_URL, future=True)
    insp = inspect(engine)
    tables = insp.get_table_names()
    print(f"Total tables: {len(tables)}\n")

    drift: dict[str, list[str]] = {}
    for t in tables:
        cols = insp.get_columns(t)
        spanish = [c["name"] for c in cols if any(w in c["name"].lower() for w in SPANISH_WORDS)]
        if spanish:
            drift[t] = spanish

    if not drift:
        print("No Spanish column names detected. Schema is in sync.")
        return

    print("=== Tables with Spanish column names ===\n")
    for t, cols in sorted(drift.items()):
        print(f"  {t}:")
        for c in cols:
            print(f"    - {c}")


if __name__ == "__main__":
    main()
