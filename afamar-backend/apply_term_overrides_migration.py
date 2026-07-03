"""One-shot migration for the MySQL deployment: add the term-override columns
that the new backend code expects (`budgets.budget_terms_override`, etc.).

Idempotent: skips columns that already exist.

Usage:
    python apply_term_overrides_migration.py
"""
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError, ProgrammingError

from app.core.settings import settings


def column_exists(conn, table: str, column: str) -> bool:
    """Best-effort check using INFORMATION_SCHEMA (works on MySQL / MariaDB)."""
    try:
        row = conn.execute(
            text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_schema = DATABASE() "
                "AND table_name = :t AND column_name = :c LIMIT 1"
            ),
            {"t": table, "c": column},
        ).first()
        return row is not None
    except Exception:
        return False


def safe_add_column(conn, table: str, column: str, decl: str) -> bool:
    """Adds `<table>` ADD COLUMN `<column>` <decl> if it doesn't exist."""
    if column_exists(conn, table, column):
        print(f"SKIP  {table}.{column} (already exists)")
        return False
    conn.execute(text(f"ALTER TABLE `{table}` ADD COLUMN `{column}` {decl}"))
    print(f"OK    {table}.{column}")
    return True


def main() -> None:
    engine = create_engine(settings.DATABASE_URL, future=True)
    statements = [
        ("budgets",     "budget_terms_override",     "TEXT NULL"),
        ("budgets",     "warranty_override",          "TEXT NULL"),
        ("work_orders", "delivery_terms_override",    "TEXT NULL"),
        ("work_orders", "warranty_override",          "TEXT NULL"),
    ]
    added = 0
    with engine.begin() as conn:
        for table, column, decl in statements:
            if safe_add_column(conn, table, column, decl):
                added += 1
    print(f"\nDone. Columns added: {added}/{len(statements)}")


if __name__ == "__main__":
    try:
        main()
    except (OperationalError, ProgrammingError) as exc:
        print(f"FAILED: {exc}")
        raise
