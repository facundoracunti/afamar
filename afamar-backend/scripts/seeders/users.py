"""Admin user seeder.

Creates the default `admin` user if the `users` table is empty. The password
comes from `ADMIN_PASSWORD` (env). Development keeps the historical fallback
for local setup; production refuses to seed without an explicit password.
"""
from __future__ import annotations

import os

from app.core.settings import settings
from app.models.user import User
from app.services.auth import hash_password
from scripts.seeders.base import SeedResult, get_logger, session_scope

ADMIN_USERNAME = "admin"
ADMIN_EMAIL = "admin@afamar.com.ar"
ADMIN_FULL_NAME = "Administrador"


def _configured_admin_password() -> str:
    """Return the configured password without allowing a production default."""
    password = os.environ.get("ADMIN_PASSWORD")
    if password:
        return password
    if settings.is_production:
        raise RuntimeError("ADMIN_PASSWORD is required when seeding users in production")
    return "admin123"


def _seed_admin_once(reset_password: bool = False) -> SeedResult:
    logger = get_logger("seeders.users")
    result = SeedResult(seeder="users")
    with session_scope() as db:
        existing = db.query(User).filter(User.username == ADMIN_USERNAME).first()
        if existing is None:
            admin_password = _configured_admin_password()
            db.add(
                User(
                    username=ADMIN_USERNAME,
                    email=ADMIN_EMAIL,
                    hashed_password=hash_password(admin_password),
                    full_name=ADMIN_FULL_NAME,
                    is_active=True,
                    is_admin=True,
                )
            )
            result.inserted = 1
            logger.info("Created admin user '%s'", ADMIN_USERNAME)
        elif reset_password:
            existing.hashed_password = hash_password(_configured_admin_password())
            existing.is_active = True
            existing.is_admin = True
            result.updated = 1
            logger.info("Reset password for admin user '%s'", ADMIN_USERNAME)
        else:
            result.skipped = 1
            logger.info("Admin user '%s' already exists (id=%s) — skipped", ADMIN_USERNAME, existing.id)
    return result


def seed_users(reset_password: bool = False) -> SeedResult:
    """Seed the admin user. Idempotent.

    Args:
        reset_password: when True, the admin password is reset even if the user
            already exists. Useful for recovering from a lost password during
            development. Do NOT use in production.
    """
    return _seed_admin_once(reset_password=reset_password)
