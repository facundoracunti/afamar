"""Additional works catalogue seeder.

Snapshot of the AFAMAR production catalogue — 13 trabajos adicionales
captured from the live database (2026-08-27). New rows are inserted on
a fresh DB; existing rows are left untouched (idempotent — preserves
manual price/formula changes).

Each entry is a tuple matching the `AdditionalWork` model's columns:
    (name, detail, price, currency_id, type, formula_constant)

- `type`: "flat" (fixed price) or "frente" (priced by linear meter
  using `formula_constant` — see `utils/frentePricing.py`).
- `currency_id`: 1 = ARS, 2 = USD (see `seed_currencies`).
- `formula_constant`: only set for `frente` rows; null for `flat`.
"""
from __future__ import annotations

from scripts.seeders.base import SeedResult, get_logger, session_scope
from app.models.additional_work import AdditionalWork


# Single source of truth: the production catalogue on 2026-07-29.
ADDITIONAL_WORKS: tuple[tuple, ...] = (
    # flat / ARS
    ("Traforo de Pileta", "Apertura y pegado de pileta", 60000.0, 1, "flat", None),
    ("Traforo de Anafe", "Apertura de anafe", 70000.0, 1, "flat", None),
    ("Traforo de Pileta de apoyo", "Apertura pileta de apoyo", 30000.0, 1, "flat", None),
    ("Mensula de Amurar", "Mensulas para mesadas", 30000.0, 1, "flat", None),
    # flat / USD
    ("Bacha Integrada", "Pileta de Material ", 420.0, 2, "flat", None),
    # frente / USD (price is 0.0 — the actual cost is linear meters *
    # formula_constant, computed at runtime)
    ("Frente Ingletetado 45°", "Frente 45°", 0.0, 2, "frente", 1.15),
    ("Frente Doble", "Doble Frente Pulido", 0.0, 2, "frente", 1.0),
    # frente / ARS
    ("Frentin Clasico Rasado", "", 0.0, 1, "frente", 1.0),
    # flat / ARS — nuevos del catálogo actual
    ("Traforo de Atornillar", "", 20000.0, 1, "flat", None),
    ("Traforo filtro de agua", "", 20000.0, 1, "flat", None),
    ("Toma de luz", "Toma de luz por unidad", 20000.0, 1, "flat", None),
    ("Toma de gas", "", 20000.0, 1, "flat", None),
    ("Traforo de Ducha", "Apertura de llave de agua", 10000.0, 1, "flat", None),
)


def seed_additional_works() -> SeedResult:
    """Insert any missing additional works rows.

    Matched by `name` (treated as the unique label). Existing rows are
    left untouched — no price/formula overwrite — so the seeder is safe
    to run on every app startup.
    """
    logger = get_logger("seeders.additional_works")
    result = SeedResult(seeder="additional_works")
    with session_scope() as db:
        existing = {a.name for a in db.query(AdditionalWork.name).all()}
        for row in ADDITIONAL_WORKS:
            name = row[0]
            if name in existing:
                result.skipped += 1
                continue
            db.add(AdditionalWork(
                name=name,
                detail=row[1],
                price=row[2],
                currency_id=row[3],
                type=row[4],
                formula_constant=row[5],
            ))
            result.inserted += 1
            logger.info("Added additional work: %s", name)

    logger.info(
        "Additional works seed done — %d inserted, %d already present",
        result.inserted, result.skipped,
    )
    return result
