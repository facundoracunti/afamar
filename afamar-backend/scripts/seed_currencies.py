"""Idempotent seeder for the `currencies` catalogue.

Run from the backend root:
    python -m scripts.seed_currencies

Re-running this script is a no-op — currencies are upserted by
`code` and the seed list matches what the migration also inserts.
Use this script when the `currencies` table exists but is empty
(e.g. you deployed to a fresh DB before the Alembic migration ran).
"""
from __future__ import annotations

import logging
import sys

sys.path.insert(0, ".")

from sqlalchemy import select
from app.db.database import SessionLocal  # noqa: E402
from app.models.reference import Currency  # noqa: E402


logger = logging.getLogger("scripts.seed_currencies")

# Single source of truth for the AFAMAR currency catalogue. Add new
# rows here when the business starts trading in a new currency — both
# the seeder and the post-migration backfill in the Alembic migration
# read from this list.
DEFAULT_CURRENCIES = [
    {"code": "ARS", "name": "Peso Argentino", "symbol": "$", "sort_order": 0},
    {"code": "USD", "name": "Dólar Estadounidense", "symbol": "USD", "sort_order": 1},
]


def main() -> int:
    inserted = 0
    updated = 0
    db = SessionLocal()
    try:
        for cur in DEFAULT_CURRENCIES:
            row = db.query(Currency).filter(Currency.code == cur["code"]).first()
            if row:
                # Refresh display fields in case they were renamed
                # upstream, but never touch `is_active` — the operator
                # might have disabled a currency on purpose.
                row.name = cur["name"]
                row.symbol = cur["symbol"]
                row.sort_order = cur["sort_order"]
                updated += 1
            else:
                db.add(Currency(**cur, is_active=True))
                inserted += 1
        db.commit()
    finally:
        db.close()
    logger.info("Currencies seed done: inserted=%d updated=%d", inserted, updated)
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    raise SystemExit(main())
