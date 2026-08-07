"""Snapshot the `materials` and `material_colors` tables to JSON.

Run BEFORE the `color_id` migration so the free-text `color` column state
can be restored if the backfill goes wrong. Reads raw table columns (not
the ORM model), so it works regardless of the model's current shape.

Usage:
    python scripts/backup_material_colors.py
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import sqlalchemy as sa

from app.db.database import engine

TABLES = ("materials", "material_colors")
BACKUP_DIR = Path(__file__).resolve().parent.parent / "backups"


def _table_snapshot(bind, table: str) -> list[dict]:
    inspector = sa.inspect(bind)
    columns = [c["name"] for c in inspector.get_columns(table)]
    rows = bind.execute(sa.text(f"SELECT {', '.join(columns)} FROM {table}")).fetchall()
    return [dict(zip(columns, row)) for row in rows]


def main() -> int:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    dest = BACKUP_DIR / f"material_colors_{timestamp}.json"

    with engine.connect() as conn:
        snapshot = {table: _table_snapshot(conn, table) for table in TABLES}

    snapshot["exported_at"] = datetime.now().isoformat(timespec="seconds")
    dest.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2, default=str), encoding="utf-8")

    print(f"Backup written: {dest}")
    print(f"  materials={len(snapshot['materials'])}  material_colors={len(snapshot['material_colors'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
