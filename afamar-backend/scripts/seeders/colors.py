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
# Mirrors the production `material_colors` catalogue (captured 2026-08-07
# after the operator cleaned up the unused rows). Keep this tuple in
# lock-step with `scripts/inspect_colors.py`'s section-1 output.
#
# Canonical-name convention: compound labels are written with **only the
# first word capitalized** (`Beige con vetas`, NOT `Beige Con Vetas`) —
# the colour backfill inserts them via `strip().lower().capitalize()`
# and a fresh DB seeded from this tuple must produce the same canonical
# names.
COLORS: tuple[str, ...] = (
    # original single-word colours (ids 1–7 kept; 8–11 dropped in 2026-08-07 cleanup
    # because they had zero materials)
    "Blanco",                  #  1
    "Negro",                   #  2
    "Gris",                    #  3
    "Beige",                   #  4
    "Crema",                   #  5
    "Rojo",                    #  6
    "Verde",                   #  7
    # compound colours inserted by the colour backfill (ids 12–32)
    "Gris veteado",            # 12
    "Rosa veteado",            # 13
    "Rojo veteado",            # 14
    "Negro veteado",           # 15
    "Negro vetas blancas",     # 16
    "Gris claro veteado",      # 17
    "Blanco veteado",          # 18
    "Blanco con vetas",        # 19
    "Negro con pintas blancas",# 20
    "Blanco con vetas gris",   # 21
    "Negro con vetas",         # 22
    "Gris oscuro con vetas",   # 23
    "Gris claro con vetas",    # 24
    "Beige con vetas",         # 25
    "Negro brillante",         # 26
    "Rojo vetas negras",       # 27
    "Rosa con vetas blancas",  # 28
    "Rosa",                    # 29
    "Gris claro",              # 30
    "Blanco con vetas grises", # 31
    "Gris oscuro",             # 32
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
