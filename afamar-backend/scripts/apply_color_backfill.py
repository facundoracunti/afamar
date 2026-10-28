"""Apply the c7d8e9f0a1b2 backfill + drop color manually (since alembic
tries to run f6a2c9d4e1b8 first and that one fails because color_id
already exists). This script is idempotent and safe to re-run.
"""
import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlalchemy import text

from app.core.settings import settings
from app.db.database import SessionLocal
from scripts.safety import Operation, classify_destination, require_operation


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply the historical material color backfill")
    parser.add_argument("--confirm", action="store_true", help="Confirm a local administrative operation")
    args = parser.parse_args()

    destination = classify_destination(settings.ENVIRONMENT, settings.DATABASE_URL)
    require_operation(destination, Operation.DDL, confirmed=args.confirm)

    db = SessionLocal()
    try:
        columns = {c[0] for c in db.execute(text("SHOW COLUMNS FROM materials")).fetchall()}
        print("columns has color:", "color" in columns, "| has color_id:", "color_id" in columns)
        if "color" not in columns or "color_id" not in columns:
            print("SKIP: nothing to backfill (missing color or color_id)")
            return

        distinct = db.execute(text(
            "SELECT DISTINCT color FROM materials "
            "WHERE color IS NOT NULL AND LENGTH(TRIM(color)) > 0"
        )).fetchall()
        for (raw,) in distinct:
            norm = raw.strip().upper()
            existing_id = db.execute(
                text("SELECT id FROM material_colors WHERE UPPER(TRIM(name)) = :n"),
                {"n": norm},
            ).scalar()
            if existing_id is None:
                canonical = raw.strip().lower().capitalize()
                db.execute(
                    text("INSERT INTO material_colors (name) VALUES (:n)"),
                    {"n": canonical},
                )
                existing_id = db.execute(
                    text("SELECT id FROM material_colors WHERE name = :n"),
                    {"n": canonical},
                ).scalar()
            db.execute(
                text(
                    "UPDATE materials SET color_id = :cid "
                    "WHERE color IS NOT NULL AND UPPER(TRIM(color)) = :n"
                ),
                {"cid": existing_id, "n": norm},
            )
        db.commit()

        linked = db.execute(text(
            "SELECT COUNT(*) FROM materials WHERE color_id IS NOT NULL"
        )).scalar()
        print(f"backfill done; rows with color_id: {linked} / "
              f"{db.execute(text('SELECT COUNT(*) FROM materials')).scalar()}")

        db.execute(text("ALTER TABLE materials DROP COLUMN color"))
        db.commit()
        print("dropped materials.color")
    finally:
        db.close()


if __name__ == "__main__":
    main()
