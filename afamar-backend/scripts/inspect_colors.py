"""Inspect-only dump of the material_colors catalogue and the
`color_name` resolved against every row in `materials`.

Run from the backend directory with the project venv:

    .\\venv\\Scripts\\python.exe scripts/inspect_colors.py

Prints three sections to stdout:

  1. ALL material_colors rows (id, name). Confirms what's already in the
     catalogue — the seeder must list exactly these names.
  2. ALL distinct (material_color_name, n_materials) tuples with counts.
     Catches typos / variants in the free-text `color` strings that
     survived the backfill.
  3. ALL materials with their resolved color_name (LEFT JOIN so
     nulls are visible). Lets you spot-check that every material has
     the colour you expect after the seeder is updated.

Does NOT mutate the database.
"""
from __future__ import annotations

import sys
from pathlib import Path

# Make `app.*` and `scripts.*` importable when run as a standalone script.
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import select, func

from app.db.database import SessionLocal
from app.models.material import Material, MaterialColor, MaterialCategory


def main() -> None:
    db = SessionLocal()
    try:
        print("\n=== 1. material_colors catalogue (id, name) ===")
        rows = db.execute(
            select(MaterialColor.id, MaterialColor.name)
            .order_by(MaterialColor.id)
        ).all()
        for cid, name in rows:
            print(f"  {cid:>4}  {name!r}")

        print("\n=== 2. distinct color_name with material counts ===")
        # Join to surface the canonical name next to the count, so we
        # can spot duplicates that survived the backfill (e.g. "GRIS"
        # vs "Gris").
        colour_count = db.execute(
            select(MaterialColor.name, func.count(Material.id))
            .join(Material, Material.color_id == MaterialColor.id, isouter=False)
            .group_by(MaterialColor.name)
            .order_by(MaterialColor.name)
        ).all()
        for name, count in colour_count:
            print(f"  {count:>4}  {name!r}")

        print("\n=== 3. materials with resolved color_name (LEFT JOIN) ===")
        mat_rows = db.execute(
            select(
                Material.id,
                Material.name,
                MaterialCategory.name.label("category"),
                MaterialColor.name.label("color_name"),
            )
            .join(MaterialCategory, Material.category_id == MaterialCategory.id, isouter=True)
            .join(MaterialColor, Material.color_id == MaterialColor.id, isouter=True)
            .order_by(MaterialCategory.name, Material.name)
        ).all()
        for mid, mname, cat, cname in mat_rows:
            print(f"  {mid:>4}  [{cat or 'NULL':<12}]  {mname!r:<40}  -> {cname!r}")
    finally:
        db.close()


if __name__ == "__main__":
    main()