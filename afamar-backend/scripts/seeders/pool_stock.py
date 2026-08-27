"""Pool stock seeder.

Snapshot of the AFAMAR production catalogue — 68 piletas (JOHNSON + MI PILETA)
captured from the live database (last refreshed 2026-08-27). New rows are
inserted on a fresh DB; existing rows are left untouched (idempotent —
preserves manual stock changes, price updates, etc.).

Each entry is a tuple matching the `PoolStock` model's columns:
    (brand, model, description, material, quantity, price, pool_type_id, currency_id)

- `pool_type_id`: 1 = SIMPLE, 2 = DOBLE (see `seed_pool_types`).
- `currency_id`: 1 = ARS, 2 = USD (see `seed_currencies`).
"""
from __future__ import annotations

from scripts.seeders.base import SeedResult, get_logger, session_scope
from app.models.pool_stock import PoolStock


# Single source of truth: the production catalogue (refreshed 2026-08-27).
POOL_STOCK: tuple[tuple, ...] = (
    # ── JOHNSON — SIMPLE (1) ────────────────────────────────────────────────
    ("JOHNSON", "CURVE SI 77 A", "", "304", 1, 261000.0, 1, 1),
    ("JOHNSON", "DANNA",
        "MEDIDAS : 56 X 35 X 14\nMODO DE COLOCACION : DE ARRIBA, DE ABAJO",
        "304", 0, 115500.0, 1, 1),
    ("JOHNSON", "E 28",
        "MEDIDAS : 34 X 28.5 X 15\n-MODO DE COLOCACION : DE ABAJO",
        "304", 1, 76000.0, 1, 1),
    ("JOHNSON", "E 37/18",
        "MEDIDAS : 37 X 34 X 18\nMODO DE COLOCACION : DE ABAJO",
        "304", 0, 98000.0, 1, 1),
    ("JOHNSON", "E 44/18",
        "MEDIDAS : 44 X 34 X 18\nMODO DE COLOCACION : DE ABAJO",
        "304", 0, 117000.0, 1, 1),
    ("JOHNSON", "E 54",
        "MEDIDAS : 54 X 36 X 24\nMODO DE COLOCACION : DE ABAJO",
        "304", 3, 190000.0, 1, 1),
    ("JOHNSON", "E 60", "60 x 37 x 20", "340", 2, 200870.0, 1, 1),
    ("JOHNSON", "G 50", "", "304", 0, 200900.0, 1, 1),
    ("JOHNSON", "LN 50",
        "MEDIDAS : 50 X 40 X 25\nMODO DE COLOCACION : DE ABAJO",
        "304", 0, 174000.0, 1, 1),
    ("JOHNSON", "LUXOR COMPACT SI71A",
        "MEDIDAS : 0.71 X 0.482 X 0.21.\n-MODO DE COLOCACION : DE ARRIBA Y DE ABAJO",
        "304", 1, 280000.0, 1, 1),
    ("JOHNSON", "LUXOR MINI SI55A",
        "MEDIDAS : 55 X 41,5 X 20.\n-MODO DE COLOCACION : DE ARRIBA Y DE ABAJO",
        "304", 1, 220000.0, 1, 1),
    ("JOHNSON", "LUXOR SI85A",
        "MEDIDAS : 0.855 X 0.482 X 0.21.\nMODO DE COLOCACION DE ARRIBA Y DE ABAJO\n",
        "304", 2, 305000.0, 1, 1),
    ("JOHNSON", "O 250L",
        "MEDIDAS : 25 (DIAMETRO) X 12.\nMODO DE COLOCACION : DE ARRIBA, DE ABAJO",
        "304", 0, 55000.0, 1, 1),
    ("JOHNSON", "O 300L",
        "MEDIDAS : 30 (DIAMETRO) X 13.5\nMODO DE COLOCACION : DE ARRIBA, DE ABAJO",
        "304", 3, 70000.0, 1, 1),
    ("JOHNSON", "O 340 L",
        "MEDIDAS : 34 (DIAMETRO) X 14.\nMODO DE COLOCACION : DE ARRIBA, DE ABAJO",
        "304", 0, 82000.0, 1, 1),
    ("JOHNSON", "OV 330 L",
        "MEDIDAS : 33 X 24 X 12.\nMODO DE COLOCACION : DE ARRIBA, DE ABAJO",
        "304", 2, 58500.0, 1, 1),
    ("JOHNSON", "OV 370 L",
        "MEDIDAS : 37 X 26.5 X 12\nMODO DE COLOCACION : DE ARRIBA, DE ABAJO ",
        "304", 4, 72500.0, 1, 1),
    ("JOHNSON", "OV 440 L",
        "MEDIDAS : 44 X 27.5 X 13\nMODO DE COLOCACION : DE ARRIBA , DE ABAJO",
        "304", 4, 81500.0, 1, 1),
    ("JOHNSON", "Q 76", "", "", 0, 329000.0, 1, 1),
    ("JOHNSON", "QUADRA MAX Q71 A",
        "MEDIDAS : 71 X 48.2 X 20\n-MODO DE COLOCACION : DE ARRIBA Y DE ABAJO",
        "304", 0, 360000.0, 1, 1),
    ("JOHNSON", "QUADRA Q 40", "", "304", 0, 153000.0, 1, 1),
    ("JOHNSON", "QUADRA Q084A",
        "MEDIDAS : 83.8 X 55.9 X 17.5\nMODO DE COLOCACION : DE ARRIBA",
        "304", 2, 500000.0, 1, 1),
    ("JOHNSON", "QUADRA Q085A",
        "MEDIDAS : 85.5 X 48.2 X 17.5\nMODO DE COLOCACION: DE ARRIBA",
        "304", 0, 480000.0, 1, 1),
    ("JOHNSON", "SIGNATURE AURA 38 RG", "38 DIAM X 11", "403", 0, 860000.0, 1, 1),
    ("JOHNSON", "SIGNATURE AXIS 55 B", "55 X 38 X 10", "403", 0, 936000.0, 1, 1),
    ("JOHNSON", "SIGNATURE ENKEL SE 45",
        "42 X 45 X 22.\nINCLUYE: REJILLA ENROLLABLE Y REJILLA INFERIOR",
        "403", 0, 477000.0, 1, 1),
    ("JOHNSON", "SIGNATURE ENKEL SE 45 DUN BLACK",
        "42 X 45 X 22.\nINCLUYE: REJILLA ENROLLABLE Y REJILLA INFERIOR\n",
        "403", 0, 724000.0, 1, 1),
    ("JOHNSON", "SIGNATURE ENKEL SE 45 ROSE GOLD",
        "42 X 45 X 22.\nINCLUYE: REJILLA ENROLLABLE Y REJILLA INFERIOR",
        "403", 0, 788000.0, 1, 1),
    ("JOHNSON", "SIGNATURE ENKEL SE 55",
        "42 X 55 X 22.\nMODO DE COLOCACION: DE ARRIBA O ABAJO.\nINCLUYE ACCESORIOS",
        "403", 0, 665000.0, 1, 1),
    ("JOHNSON", "SIGNATURE ENKEL SE 55 GB",
        "42 X 55 X 22 \nMODO DE COLOCACION: DE ARRIBA O ABAJO.\nINCLUYE ACCESORIOS",
        "403", 0, 1040000.0, 1, 1),
    ("JOHNSON", "SIGNATURE ENKEL SE 55 ROSE GOLD",
        "42 X 55 X 22.\nINCLUYE REJILLA ENROLLABLE",
        "403", 0, 985000.0, 1, 1),
    ("JOHNSON", "SIGNATURE ENKEL SE 75",
        "42 X 75 X 22\nCOLOCACION: ARRIBA Y ABAJO.\nINCLUYE ACCESORIOS",
        "403", 0, 858000.0, 1, 1),
    ("JOHNSON", "SIGNATURE ENKEL SE 75 GB",
        "42 X 75 X 22 \nMODO DE COLOCACION: DE ARRIBA O ABAJO\nINCLUYE ACEESORIOS",
        "403", 0, 1384000.0, 1, 1),
    ("JOHNSON", "SIGNATURE ENKEL SE 75 ROSE GOLD",
        "42 X 75 X 22\n", "403", 0, 1287000.0, 1, 1),
    ("JOHNSON", "T 34/18", "MEDIDAS : 34 X 23.5 X 18", "304", 0, 86000.0, 1, 1),
    ("JOHNSON", "Z 52/18", "", "304", 2, 110000.0, 1, 1),
    ("JOHNSON", "ZZ 52", "", "430", 0, 55000.0, 1, 1),

    # ── JOHNSON — DOBLE (2) ─────────────────────────────────────────────────
    ("JOHNSON", "C 28/18",
        "MEDIDAS : 59.8 X 34 X 18\nMODO DE COLOCACION : DE ABAJO",
        "304", 3, 166000.0, 2, 1),
    ("JOHNSON", "C 37/18",
        "MEDIDAS : 70.8 X 37 X 18. \nMODO DE COLOCACION : DE ABAJO",
        "304", 1, 195000.0, 2, 1),
    ("JOHNSON", "R 37/18",
        "MEDIDAS : 63.3 X 34 X 18.\nMODO DE COLOCACION : DE ABAJO ",
        "304", 6, 185000.0, 2, 1),
    ("JOHNSON", "R 63 CR", "63.8 X 37 X 15", "304", 3, 177000.0, 2, 1),
    ("JOHNSON", "R 63/18",
        "MEDIDAS : 63.8 X 37 X 18\nMODO DE COLOCACION : DE ABAJO",
        "304", 2, 198000.0, 2, 1),
    ("JOHNSON", "R 63/18 F", "70.5X 43.5 X 18.5", "304", 1, 218000.0, 2, 1),

    # ── MI PILETA — SIMPLE (1) ───────────────────────────────────────────────
    ("MI PILETA", "101 EC", "", "430", 10, 40000.0, 1, 1),
    ("MI PILETA", "102 EC", "MEDIDAS : 34 X 37 X 15", "430", 10, 45000.0, 1, 1),
    ("MI PILETA", "103 P", "MEDIDAS : 52 X 32 X 18", "430", 10, 50000.0, 1, 1),
    ("MI PILETA", "104 P", "MEDIDAS : 57 X 37 X 18", "430", 10, 83000.0, 1, 1),
    ("MI PILETA", "143 EC", "MEDIDAS : 44 X 34 X 15", "430", 10, 45000.0, 1, 1),
    ("MI PILETA", "201", "MEDIDAS : 27 X 37 X 15", "304", 10, 62000.0, 1, 1),
    ("MI PILETA", "205", "MEDIDAS : 64 X 37 X 15", "304", 10, 135000.0, 1, 1),
    ("MI PILETA", "243", "MEDIDAS : 44 X 34 X 15", "304", 10, 75000.0, 1, 1),
    ("MI PILETA", "301", "MEDIDAS : 27 X 37 X 18", "304", 10, 73000.0, 1, 1),
    ("MI PILETA", "302", "MEDIDAS : 34 X 37 X 18", "304", 10, 83000.0, 1, 1),
    ("MI PILETA", "303", "MEDIDAS : 52 X 32 X 18", "304", 10, 88000.0, 1, 1),
    ("MI PILETA", "304", "MEDIDAS : 57 X 37 X 18", "304", 10, 140000.0, 1, 1),
    ("MI PILETA", "306", "MEDIDAS : 71 X 37 X 18", "304", 10, 160000.0, 1, 1),
    ("MI PILETA", "342", "", "304", 0, 85000.0, 1, 1),
    ("MI PILETA", "343", "MEDIDAS : 44 X 34 X 18", "304", 10, 88000.0, 1, 1),
    ("MI PILETA", "345", "MEDIDAS : 67 X 34 X 18", "304", 10, 155000.0, 1, 1),
    ("MI PILETA", "403", "MEDIDAS : 52 X 32 X 20", "304", 9, 120000.0, 1, 1),
    ("MI PILETA", "404", "MEDIDAS : 57 X 37 X 20", "304", 10, 176000.0, 1, 1),
    ("MI PILETA", "410", "MEDIDAS : 60 X 37 X 20", "304", 10, 160000.0, 1, 1),
    ("MI PILETA", "410 P", "MEDIDAS : 60 X 37 X 24", "304", 10, 168000.0, 1, 1),
    ("MI PILETA", "445", "MEDIDAS : 67 X 34 X 20", "304", 10, 190000.0, 1, 1),
    ("MI PILETA", "453 E", "", "304", 10, 55000.0, 1, 1),
    ("MI PILETA", "715 E", "", "", 4, 595000.0, 1, 1),
    ("MI PILETA", "DESIGNA 787", "", "", 3, 210000.0, 1, 1),
    ("MI PILETA", "ESSENTIA", "76X45X20", "", 4, 515000.0, 1, 1),
)


def seed_pool_stock() -> SeedResult:
    """Insert any missing pool stock rows.

    Matched by the composite `(brand, model)` key — the production
    catalogue treats each `model` as unique within a `brand`. Existing
    rows are left fully untouched (no price/quantity overwrite) so the
    seeder is safe to run on every app startup.
    """
    logger = get_logger("seeders.pool_stock")
    result = SeedResult(seeder="pool_stock")
    with session_scope() as db:
        existing = {
            (p.brand, p.model)
            for p in db.query(PoolStock.brand, PoolStock.model).all()
        }
        for row in POOL_STOCK:
            brand, model = row[0], row[1]
            if (brand, model) in existing:
                result.skipped += 1
                continue
            db.add(PoolStock(
                brand=brand,
                model=model,
                description=row[2],
                material=row[3],
                quantity=row[4],
                price=row[5],
                pool_type_id=row[6],
                currency_id=row[7],
            ))
            result.inserted += 1
            logger.info("Added pool stock: %s %s", brand, model)

    logger.info(
        "Pool stock seed done — %d inserted, %d already present",
        result.inserted, result.skipped,
    )
    return result
