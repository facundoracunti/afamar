"""Default settings seeder.

Inserts the key/value rows the rest of the app expects (`company_name`,
PDF terms, logo path, etc.) when the `settings` table is empty.

Idempotent: missing rows are inserted; existing rows are left untouched.
"""
from __future__ import annotations

from typing import Final

from scripts.seeders.base import SeedResult, get_logger, session_scope
from app.models.setting import Setting


# (key, default_value)
DEFAULT_SETTINGS: Final[tuple[tuple[str, str], ...]] = (
    ("company_name",            "AFAMAR"),
    ("company_address",         ""),
    ("company_phone",           ""),
    ("company_email",           ""),
    ("company_logo",            ""),
    ("pdf_footer",              ""),
    ("budget_terms",            ""),
    ("delivery_terms",          ""),
    ("warranty_text",           ""),
    ("observaciones_automaticas", ""),
)


def seed_settings() -> SeedResult:
    """Insert any missing default setting rows."""
    logger = get_logger("seeders.settings")
    result = SeedResult(seeder="settings")
    with session_scope() as db:
        existing = {row.key for row in db.query(Setting).all()}
        for key, value in DEFAULT_SETTINGS:
            if key in existing:
                result.skipped += 1
                continue
            db.add(Setting(key=key, value=value))
            result.inserted += 1

    logger.info(
        "Settings seed done — %d inserted, %d already present",
        result.inserted, result.skipped,
    )
    return result
