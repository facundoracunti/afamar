"""Pool types seeder.

Inserts "Simple" and "Doble" pool types. Idempotent.
"""
from __future__ import annotations

from typing import Final

from scripts.seeders.base import SeedResult, get_logger, session_scope, upsert_by_name
from app.models.pool_stock import PoolType


POOL_TYPES: Final[tuple[tuple[str, str, int], ...]] = (
    ("SIMPLE", "Simple", 1),
    ("DOBLE", "Doble", 2),
)


def seed_pool_types() -> SeedResult:
    """Insert pool types if missing."""
    logger = get_logger("seeders.pool_types")
    result = SeedResult(seeder="pool_types")
    with session_scope() as db:
        for name, label, sort_order in POOL_TYPES:
            _, created = upsert_by_name(db, PoolType, name, {"label": label, "sort_order": sort_order}, update_fields=("label", "sort_order"))
            if created:
                result.inserted += 1
            else:
                result.skipped += 1

    logger.info(
        "Pool types seed done — %d inserted, %d already present",
        result.inserted, result.skipped,
    )
    return result
