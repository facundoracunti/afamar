"""Material categories, colors, and thicknesses seeder.

The list mirrors what is already loaded in the production database:
  - 5 categories: General, Granitos, Cuarzos, Sinterizados, Mármoles
  - 11 colors
  - 5 thicknesses

The seeder is idempotent: rows are matched by `name` and missing rows are
inserted. Existing rows are left untouched.
"""
from __future__ import annotations

from scripts.seeders.base import SeedResult, get_logger, session_scope
from app.models.material import MaterialCategory, MaterialColor, MaterialThickness


# Single source of truth: the canonical Spanish labels AFAMAR uses in the UI.
CATEGORIES: tuple[str, ...] = (
    "General",
    "Granitos",
    "Cuarzos",
    "Sinterizados",
    "Mármoles",
)

COLORS: tuple[str, ...] = (
    "Blanco",
    "Negro",
    "Gris",
    "Beige",
    "Crema",
    "Rojo",
    "Verde",
    "Azul",
    "Marrón",
    "Dorado",
    "Plateado",
)

THICKNESSES: tuple[str, ...] = (
    "1cm",
    "2cm",
    "3cm",
    "4cm",
    "6cm",
)


def seed_categories() -> SeedResult:
    """Insert any missing material categories, colors, and thicknesses."""
    logger = get_logger("seeders.categories")
    result = SeedResult(seeder="categories")
    with session_scope() as db:
        existing_cat = {c.name for c in db.query(MaterialCategory).all()}
        for name in CATEGORIES:
            if name in existing_cat:
                result.skipped += 1
                continue
            db.add(MaterialCategory(name=name))
            result.inserted += 1
            logger.info("Added category: %s", name)

        existing_colors = {c.name for c in db.query(MaterialColor).all()}
        for name in COLORS:
            if name in existing_colors:
                result.skipped += 1
                continue
            db.add(MaterialColor(name=name))
            result.inserted += 1

        existing_thick = {t.name for t in db.query(MaterialThickness).all()}
        for name in THICKNESSES:
            if name in existing_thick:
                result.skipped += 1
                continue
            db.add(MaterialThickness(name=name))
            result.inserted += 1

    logger.info(
        "Categories seed done — %d inserted, %d already present",
        result.inserted, result.skipped,
    )
    return result
