"""Common materials seeder.

Inserts a curated list of common marble / granite / quartz / sintered
materials with their default base price (ARS, per m²). The list mirrors
the reference project's catalog and is safe to extend.

Each material entry is `(name, category_name, color, thickness, base_price)`.
When a row with the same `name` already exists it is left untouched — the
seeder is fully idempotent.

A `PriceHistory` row is created for every new material so the price-history
report has at least one data point per SKU. The history insert uses raw SQL
that introspects the actual column names so it works on both:
  - the canonical English schema (current model),
  - legacy MySQL deployments that still have the original Spanish column
    names (`material_nombre`, `precio_m2`).
"""
from __future__ import annotations

from typing import Final

from sqlalchemy import inspect, text

from scripts.seeders.base import SeedResult, get_logger, session_scope
from app.models.material import Material, MaterialCategory


# (name, category, color, thickness, base_price_ars)
COMMON_MATERIALS: Final[tuple[tuple[str, str, str, str, float], ...]] = (
    # Granitos
    ("Granito Negro Absoluto",     "Granitos",     "Negro",  "2cm", 45.0),
    ("Granito Blanco Dallas",      "Granitos",     "Blanco", "2cm", 50.0),
    ("Granito Gris Pulido",        "Granitos",     "Gris",   "2cm", 40.0),
    ("Granito Verde Ubatuba",      "Granitos",     "Verde",  "2cm", 55.0),
    # Cuarzos
    ("Cuarzo Blanco Polar",        "Cuarzos",      "Blanco", "2cm", 70.0),
    ("Cuarzo Gris Oxford",         "Cuarzos",      "Gris",   "2cm", 75.0),
    ("Cuarzo Beige",               "Cuarzos",      "Beige",  "2cm", 65.0),
    ("Cuarzo Calacatta",           "Cuarzos",      "Blanco", "2cm", 95.0),
    # Sinterizados
    ("Sinterizado Dekton",         "Sinterizados", "Gris",   "2cm", 100.0),
    ("Sinterizado Neolith",        "Sinterizados", "Blanco", "2cm", 110.0),
    ("Sinterizado Negro Mate",     "Sinterizados", "Negro",  "1cm", 120.0),
    # Mármoles
    ("Mármol Travertino",          "Mármoles",     "Beige",  "3cm", 60.0),
    ("Mármol Crema Marfil",        "Mármoles",     "Crema",  "3cm", 55.0),
    ("Mármol Carrara",             "Mármoles",     "Blanco", "3cm", 65.0),
    ("Mármol Negro Marquina",      "Mármoles",     "Negro",  "3cm", 85.0),
)


# Accepted alias for the `material_name` column in `price_history`.
_MATERIAL_NAME_CANDIDATES: Final[tuple[str, ...]] = ("material_name", "material_nombre")
_PRICE_CANDIDATES: Final[tuple[str, ...]] = ("price_m2", "precio_m2")
_DATE_CANDIDATES: Final[tuple[str, ...]] = ("date", "fecha")


def _detect_price_history_columns(db) -> dict[str, str | None]:
    """Inspect `price_history` and return the actual column name for each
    logical field. Returns `None` for a logical field whose column is missing.
    """
    insp = inspect(db.get_bind())
    actual = {c["name"] for c in insp.get_columns("price_history")}

    def first(candidates: tuple[str, ...]) -> str | None:
        return next((c for c in candidates if c in actual), None)

    return {
        "material_name": first(_MATERIAL_NAME_CANDIDATES),
        "price": first(_PRICE_CANDIDATES),
        "date": first(_DATE_CANDIDATES),
    }


def _insert_price_history(
    db,
    *,
    material_id: int,
    material_name: str,
    price: float,
    cols: dict[str, str | None],
) -> bool:
    """Best-effort price history insert. Returns True on success, False when
    the table is missing required columns. Errors are logged but never raise
    so the surrounding material insert still commits.
    """
    if not cols["price"]:
        return False
    assignments: list[str] = ["material_id = :material_id", f"{cols['price']} = :price"]
    params: dict[str, object] = {"material_id": material_id, "price": price}
    if cols["material_name"]:
        assignments.append(f"{cols['material_name']} = :material_name")
        params["material_name"] = material_name
    if cols["date"]:
        assignments.append(f"{cols['date']} = NOW()")
    sql = f"INSERT INTO price_history ({', '.join(assignments)})"
    db.execute(text(sql), params)
    return True


def seed_materials() -> SeedResult:
    """Insert any missing common materials (idempotent).

    Materials with a category name that does not exist in `material_categories`
    are skipped with a warning — this keeps the seeder forward-compatible with
    category renames/removals.
    """
    logger = get_logger("seeders.materials")
    result = SeedResult(seeder="materials")
    with session_scope() as db:
        cat_map = {c.name: c.id for c in db.query(MaterialCategory).all()}
        existing_names = {m.name for m in db.query(Material.name).all()}
        price_cols = _detect_price_history_columns(db)
        if not price_cols["price"]:
            logger.warning(
                "price_history table missing the price column "
                "(checked: %s) — history rows will be skipped",
                _PRICE_CANDIDATES,
            )

        for name, category_name, color, thickness, price in COMMON_MATERIALS:
            if name in existing_names:
                result.skipped += 1
                continue
            category_id = cat_map.get(category_name)
            if category_id is None:
                msg = f"category '{category_name}' not found, skipping '{name}'"
                logger.warning(msg)
                result.errors.append(msg)
                continue
            material = Material(
                name=name,
                category_id=category_id,
                color=color,
                available_thickness=thickness,
                base_price=price,
                currency="ARS",
            )
            db.add(material)
            db.flush()  # need material.id for the price history FK
            try:
                if _insert_price_history(
                    db,
                    material_id=material.id,
                    material_name=name,
                    price=price,
                    cols=price_cols,
                ):
                    db.flush()
            except Exception as exc:  # pragma: no cover - DB-specific
                # The session is inside `session_scope()` which will rollback
                # on exception. We swallow here so the material itself
                # commits; the history row is best-effort.
                logger.warning(
                    "PriceHistory insert failed for '%s' (%s) — material "
                    "saved, history row skipped.",
                    name, exc.__class__.__name__,
                )
            result.inserted += 1
            logger.info("Added material: %s (%.2f ARS/m²)", name, price)

    logger.info(
        "Materials seed done — %d inserted, %d already present",
        result.inserted, result.skipped,
    )
    return result
