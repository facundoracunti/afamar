"""Materials seeder.

Snapshot of the AFAMAR production catalogue — 64 materials captured from
the live database (last refreshed 2026-08-27). Each entry matches the `Material`
model's columns:

    (name, category_name, color_name, thickness, base_price, price_usd,
     currency_id, supplier, stock_available, notes)

The `color_name` string is resolved to a `color_id` FK against the
`material_colors` catalogue (matched case-insensitively; unknown names
create the canonical row on the fly).

New rows are inserted on a fresh DB; existing rows are left untouched
(idempotent — preserves manual price/stock changes).

Notes on the snapshot:
- Most production rows carry the canonical price in `base_price` (ARS
  rows) or `price_usd` (USD rows); the other column is the conversion
  reference and is kept populated by the service for the totals block.
- The legacy `COMMON_MATERIALS` entries (ids 169–183 in production) are
  included in the snapshot for completeness so the local DB mirrors
  production 1:1. They are not curated reference data — treat them as
  regular catalogue rows.
- Production has a few duplicate names (`NEGRO BRASIL LEATHER` x2,
  `GRIS CITY` x2). The seeder keeps one canonical row per name and
  drops the duplicate snapshot entries — those are operator data
  issues, not catalogue entries.
- Price history: we do NOT auto-create `PriceHistory` rows for snapshot
  entries. The historical prices are part of the operator's reality and
  the report accepts a missing history row gracefully.
"""
from __future__ import annotations

from typing import Final

from scripts.seeders.base import SeedResult, get_logger, session_scope
from app.models.material import Material, MaterialCategory, MaterialColor


# Single source of truth: the production catalogue on 2026-07-29.
# Tuple shape: (name, category, color, thickness, base_price, price_usd, currency_id, supplier, stock_available, notes)
MATERIALS: Final[tuple[tuple, ...]] = (
    # ── Granitos (cat 2) ────────────────────────────────────────────────────
    ("GRIS MARA",                     "Granitos", "GRIS",                  "2 CM", 180000.0, 180.0,  1, "", 999, ""),
    ("ROSA DE SALTO ",                "Granitos", "ROSA",                  "2 CM", 180000.0, 180.0,  1, "", 999, ""),
    ("GRIS PERLA",                    "Granitos", "GRIS",                  "2 CM", 180000.0, 180.0,  1, "", 999, ""),
    ("GRIS MARA LEATHER",             "Granitos", "GRIS",                  "2 CM", 180000.0, 180.0,  1, "", 999, ""),
    ("ROJO OLAVARRIA",                "Granitos", "ROJO",                  "2 CM", 200000.0, 200.0,  1, "", 999, ""),
    ("NEGRO BOREAL",                  "Granitos", "NEGRO",                 "2 CM", 250000.0, 250.0,  1, "", 999, ""),
    ("CHACARERA",                     "Granitos", "NEGRO",                 "2 CM", 215000.0, 215.0,  1, "", 999, ""),
    ("NEGRO BRASIL",                  "Granitos", "NEGRO",                 "2 CM", 330000.0, 330.0,  2, "", 999, ""),
    ("VIA LACTEA",                    "Granitos", "NEGRO",                 "2 CM", 360000.0, 360.0,  2, "", 999, ""),
    ("NEGRO ABSOLUTO",                "Granitos", "NEGRO",                 "2 CM", 900000.0, 900.0,  2, "", 999, ""),
    ("FORTALEZA",                     "Granitos", "GRIS CLARO",            "2 CM", 240000.0, 240.0,  2, "", 999, ""),
    ("DALLAS",                        "Granitos", "GRIS CLARO",            "2 CM", 300000.0, 300.0,  2, "", 999, ""),
    ("CARAVELLAS WHITE",              "Granitos", "BLANCO",                "2 CM", 350000.0, 350.0,  2, "", 999, ""),
    ("NEGRO BRASIL LEATHER",          "Granitos", "NEGRO",                 "2 CM", 330000.0, 330.0,  2, "", 999, ""),
    ("NEGRO BRASIL LEATHER",          "Granitos", "NEGRO ",                "2 CM", 330000.0, 330.0,  2, "",  98, ""),
    ("Rojo Sierra Chica",             "Granitos", "Rojo Vetas Negras",     "2 cm", 200000.0, 200.0,  1, "", 998, ""),
    ("ROJO DRAGON",                   "Granitos", "ROJO ",                 "2",    200000.0, 200.0,  1, "",   5, ""),
    # ── legacy COMMON_MATERIALS ids preserved ──────────────────────────────
    ("Granito Negro Absoluto",        "Granitos", "Negro",                 "2cm",     45.0,   0.0,  1, None, 999, None),
    ("Granito Blanco Dallas",         "Granitos", "Blanco",                "2cm",     50.0,   0.0,  1, None, 999, None),
    ("Granito Gris Pulido",           "Granitos", "Gris",                  "2cm",     40.0,   0.0,  1, None, 999, None),
    ("Granito Verde Ubatuba",         "Granitos", "Verde",                 "2cm",     55.0,   0.0,  1, None, 999, None),

    # ── Cuarzos (cat 3) ────────────────────────────────────────────────────
    ("BLANCO SUGGAR",                 "Cuarzos",  "BLANCO",                "2 CM", 335000.0, 335.0,  2, "", 999, ""),
    ("ABSOLUTE WHITE",                "Cuarzos",  "BLANCO",                "2 CM", 400000.0, 400.0,  2, "", 999, ""),
    ("BLANCO POLAR",                  "Cuarzos",  "BLANCO",                "2 CM", 485000.0, 485.0,  2, "", 999, ""),
    ("BLANCO NORTE",                  "Cuarzos",  "BLANCO",                "2 CM", 590000.0, 590.0,  2, "", 999, ""),
    ("MIAMI WHITE",                   "Cuarzos",  "BLANCO",                "2 CM", 680000.0, 680.0,  2, "", 999, ""),
    ("GRIS TOPO",                     "Cuarzos",  "GRIS",                  "2 CM", 680000.0, 680.0,  2, "", 999, ""),
    ("ZIRCONIUM",                     "Cuarzos",  "NEGRO CON PINTAS BLANCAS", "2 CM", 750000.0, 750.0, 2, "", 999, ""),
    ("GRIS CITY",                     "Cuarzos",  "GRIS",                  "2 CM",   390.0,   0.39, 2, "",   0, ""),
    ("GRIS CITY",                     "Cuarzos",  "GRIS",                  "2 CM", 390000.0, 390.0,  2, "",   0, ""),
    ("GRIS CITY 1",                   "Cuarzos",  "GRIS",                  "2 CM", 390000.0, 390.0,  2, "", 9999, ""),
    # nuevos del catálogo actual (2026-08-27)
    ("Blanco Neves",                  "Cuarzos",  "Blanco",                "2 CM", 350000.0, 350.0,  2, "", 999, ""),
    ("Blanco paloma",                 "Cuarzos",  "Blanco",                "2",    458000.0, 458.0,  2, "",   0, ""),
    # legacy
    ("Cuarzo Blanco Polar",           "Cuarzos",  "Blanco",                "2cm",     70.0,   0.0,  1, None, 999, None),
    ("Cuarzo Gris Oxford",            "Cuarzos",  "Gris",                  "2cm",     75.0,   0.0,  1, None, 999, None),
    ("Cuarzo Beige",                  "Cuarzos",  "Beige",                 "2cm",     65.0,   0.0,  1, None, 999, None),
    ("Cuarzo Calacatta",              "Cuarzos",  "Blanco",                "2cm",     95.0,   0.0,  1, None, 999, None),

    # ── Sinterizados (cat 4) ────────────────────────────────────────────────
    ("ZEN MATE",                      "Sinterizados", "BLANCO",             "1.2 CM", 350000.0, 350.0, 2, "", 999, ""),
    ("TOTAL WHITE",                   "Sinterizados", "BLANCO",             "1.2 CM", 350000.0, 350.0, 2, "", 999, ""),
    ("STATUARIO MATE",                "Sinterizados", "BLANCO CON VETAS GRIS", "1.2 CM", 350000.0, 350.0, 2, "", 999, ""),
    ("STATUARIO BRILLANTE",           "Sinterizados", "BLANCO CON VETAS GRISES", "1.2 CM", 350000.0, 350.0, 2, "", 999, ""),
    ("MARQUINA MATE",                 "Sinterizados", "NEGRO CON VETAS",    "1.2 CM", 350000.0, 350.0, 2, "", 999, ""),
    ("MARQUINA BRILLANTE",            "Sinterizados", "NEGRO CON VETAS",    "1.2 CM", 350000.0, 350.0, 2, "", 999, ""),
    ("GAMMA GREY",                    "Sinterizados", "GRIS OSCURO",        "1.2 CM", 350000.0, 350.0, 2, "", 999, ""),
    ("CALACATTA LUXURY BRILLANTE",    "Sinterizados", "BLANCO VETEADO",     "1.2 CM", 350000.0, 350.0, 2, "", 999, ""),
    # nuevo del catálogo actual (2026-08-27)
    ("Calacatta luxe",                "Sinterizados", "Blanco con vetas",   "1.2 ", 1255000.0, 1255.0, 2, "Neolith", 999, ""),
    ("LIMESTONE CREAM",               "Sinterizados", "BEIGE ",             "1.2 CM", 350000.0, 350.0, 2, "", 999, ""),
    ("TUNDRA GAMMA ",                 "Sinterizados", "GRIS CLARO CON VETAS", "1.2 CM", 350000.0, 350.0, 2, "", 999, ""),
    ("BEIGE CREAM",                   "Sinterizados", "BEIGE",              "1.2 CM", 350000.0, 350.0, 2, "", 999, ""),
    ("TRAVERTINO BEIGE",              "Sinterizados", "BEIGE CON VETAS ",   "1.2 CM", 350000.0, 350.0, 2, "", 999, ""),
    ("TAJ MAHAL",                     "Sinterizados", "BEIGE CON VETAS",    "1.2 CM", 350000.0, 350.0, 2, "", 999, ""),
    ("TOTAL BLACK",                   "Sinterizados", "NEGRO BRILLANTE",    "1.2 CM", 350000.0, 350.0, 2, "", 999, ""),
    # legacy
    ("Sinterizado Dekton",            "Sinterizados", "Gris",              "2cm",     100.0,   0.0,  1, None, 999, None),
    ("Sinterizado Neolith",           "Sinterizados", "Blanco",            "2cm",     110.0,   0.0,  1, None, 999, None),
    ("Sinterizado Negro Mate",        "Sinterizados", "Negro",             "1cm",     120.0,   0.0,  1, None, 999, None),

    # ── Mármoles (cat 5) ────────────────────────────────────────────────────
    ("BLANCO TURCO",                  "Mármoles", "BLANCO",                "2 CM",  530000.0,  530.0, 2, "", 999, ""),
    ("CARRARA",                       "Mármoles", "BLANCO VETEADO",        "2 CM",  680000.0,  680.0, 2, "", 999, ""),
    # nuevo del catálogo actual (2026-08-27)
    ("Arabescato",                    "Mármoles", "Rosa con vetas blancas", "2",    970000.0,  970.0, 2, "",   3, ""),
    ("CALACATTA",                     "Mármoles", "BLANCO CON VETAS",      "2 CM", 1560000.0, 1560.0, 2, "", 999, ""),
    ("TRAVERTINO AL AGUA",            "Mármoles", "BEIGE",                 "2 CM",  500000.0,  500.0, 2, "", 999, ""),
    ("TRAVERTINO A LA VETA",          "Mármoles", "BEIGE",                 "2 CM",  680000.0,  680.0, 2, "", 999, ""),
    ("STATUARIETTO ",                 "Mármoles", "BLANCO ",               "2 CM", 1000000.0, 1000.0, 2, "", 999, ""),
    # legacy
    ("Mármol Travertino",             "Mármoles", "Beige",                 "3cm",      60.0,    0.0, 1, None, 999, None),
    ("Mármol Crema Marfil",           "Mármoles", "Crema",                 "3cm",      55.0,    0.0, 1, None, 999, None),
    ("Mármol Carrara",                "Mármoles", "Blanco",                "3cm",      65.0,    0.0, 1, None, 999, None),
    ("Mármol Negro Marquina",         "Mármoles", "Negro",                 "3cm",      85.0,    0.0, 1, None, 999, None),
)


def seed_materials() -> SeedResult:
    """Insert any missing materials (idempotent — matched by name).

    Matched by `name` only. Production may have duplicate names (e.g.
    `NEGRO BRASIL LEATHER` x2, `GRIS CITY` x2) — those are operator
    errors rather than catalogue entries, so the seeder keeps one
    canonical row per name and skips the duplicate snapshot entries.
    """
    logger = get_logger("seeders.materials")
    result = SeedResult(seeder="materials")
    with session_scope() as db:
        cat_map = {c.name: c.id for c in db.query(MaterialCategory).all()}
        color_map = {c.name.upper(): c.id for c in db.query(MaterialColor).all()}
        existing_names = {m.name for m in db.query(Material.name).all()}
        for row in MATERIALS:
            (name, category_name, color, thickness,
             base_price, price_usd, currency_id,
             supplier, stock_available, notes) = row
            if name in existing_names:
                result.skipped += 1
                continue
            category_id = cat_map.get(category_name)
            if category_id is None:
                msg = f"category '{category_name}' not found, skipping '{name}'"
                logger.warning(msg)
                result.errors.append(msg)
                continue
            color_id = _resolve_color_id(db, color, color_map)
            material = Material(
                name=name,
                category_id=category_id,
                color_id=color_id,
                available_thickness=thickness,
                base_price=base_price,
                price_usd=price_usd,
                currency_id=currency_id,
                supplier=supplier,
                stock_available=stock_available or 0,
                notes=notes,
            )
            db.add(material)
            existing_names.add(name)
            result.inserted += 1
            logger.info("Added material: %s", name)

    logger.info(
        "Materials seed done — %d inserted, %d already present",
        result.inserted, result.skipped,
    )
    return result


def _resolve_color_id(db, color_name: str | None, color_map: dict[str, int]) -> int | None:
    """Resolve a free-text color name to a `color_id`, creating the canonical
    catalogue row when the name is unknown (case-insensitive)."""
    stripped = (color_name or "").strip()
    if not stripped:
        return None
    normalized = stripped.upper()
    color_id = color_map.get(normalized)
    if color_id is not None:
        return color_id
    canonical = stripped.lower().capitalize()
    color_obj = MaterialColor(name=canonical)
    db.add(color_obj)
    db.flush()
    color_map[normalized] = color_obj.id
    return color_obj.id
