"""Material colors seeder.

The catalogue mirrors what is already loaded in the production database
after the `color_id` migration (canonical names, only the first word
capitalized):

  - the 11 pre-existing single-word colors (Blanco, Negro, Gris, …)
  - the colors inserted by the backfill migration from the free-text
    `materials.color` values (e.g. `BEIGE CON VETAS ` → `Beige con vetas`,
    `Gris Veteado` → `Gris veteado`)

The seeder is idempotent: rows are matched case-insensitively by `name`
and missing rows are inserted. Existing rows are left untouched.
"""
from __future__ import annotations

from sqlalchemy import func

from scripts.seeders.base import SeedResult, get_logger, session_scope
from app.models.material import MaterialColor


# Single source of truth: the canonical Spanish labels AFAMAR uses in the UI.
# The list mirrors the production catalogue after the backfill: the 11
# original single-word colors plus the compound colors seen in real data
# (Gris veteado, Negro con vetas, Blanco con vetas gris, …).
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
    "Rosa",
    "Gris claro",
    "Gris oscuro",
    "Gris veteado",
    "Gris claro veteado",
    "Gris claro con vetas",
    "Gris oscuro con vetas",
    "Negro brillante",
    "Negro veteado",
    "Negro con vetas",
    "Negro vetas blancas",
    "Negro con pintas blancas",
    "Blanco veteado",
    "Blanco con vetas",
    "Blanco con vetas gris",
    "Blanco con vetas grises",
    "Beige con vetas",
    "Rojo veteado",
    "Rojo vetas negras",
    "Rosa veteado",
    "Rosa con vetas blancas",
)


def seed_colors() -> SeedResult:
    """Insert any missing material colors (idempotent — matched by name)."""
    logger = get_logger("seeders.colors")
    result = SeedResult(seeder="colors")
    with session_scope() as db:
        existing = {c.name.upper() for c in db.query(MaterialColor).all()}
        for name in COLORS:
            if name.upper() in existing:
                result.skipped += 1
                continue
            db.add(MaterialColor(name=name))
            result.inserted += 1
            logger.info("Added color: %s", name)

    logger.info(
        "Colors seed done — %d inserted, %d already present",
        result.inserted, result.skipped,
    )
    return result
