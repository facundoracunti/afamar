"""Logical backup of the tables we're about to touch: `materials`,
`material_colors`, and `alembic_version`. Writes INSERT statements to
a file so we can restore by piping them back into `mysql`.

Run from the backend directory:

    .\\venv\\Scripts\\python.exe scripts/backup_color_tables.py

Reads DB_* from environment. Does NOT mutate the database.
"""
from __future__ import annotations

import os
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import inspect, text

from app.db.database import SessionLocal
from app.core.settings import settings


TABLES = ("material_colors", "materials", "alembic_version")


def main() -> None:
    db = SessionLocal()
    try:
        insp = inspect(db.get_bind())
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        out_path = ROOT / f"backups/pre_color_migration_{timestamp}.sql"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        print(f"Writing backup to {out_path}")

        with out_path.open("w", encoding="utf-8") as fh:
            fh.write(f"-- Backup taken {timestamp}\n")
            fh.write(f"-- DB: {settings.DATABASE_URL_SAFE}\n")
            fh.write("SET FOREIGN_KEY_CHECKS=0;\n\n")

            for table in TABLES:
                if not insp.has_table(table):
                    print(f"  ! table {table!r} does not exist, skipping")
                    continue
                cols = [c["name"] for c in insp.get_columns(table)]
                col_list = ", ".join(f"`{c}`" for c in cols)
                rows = db.execute(text(f"SELECT {col_list} FROM `{table}`")).fetchall()
                print(f"  {table}: {len(rows)} row(s)")
                if not rows:
                    continue
                for row in rows:
                    params = dict(zip(cols, row))
                    values_sql = []
                    for c in cols:
                        v = params[c]
                        if v is None:
                            values_sql.append("NULL")
                        elif isinstance(v, bool):
                            values_sql.append("1" if v else "0")
                        elif isinstance(v, (int, float)):
                            values_sql.append(str(v))
                        else:
                            escaped = str(v).replace("\\", "\\\\").replace("'", "\\'")
                            values_sql.append(f"'{escaped}'")
                    fh.write(
                        f"INSERT INTO `{table}` ({col_list}) VALUES "
                        f"({', '.join(values_sql)});\n"
                    )

            fh.write("\nSET FOREIGN_KEY_CHECKS=1;\n")
        print("Backup complete.")
    finally:
        db.close()


if __name__ == "__main__":
    main()