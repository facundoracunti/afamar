"""Admin user seeder.

Creates the default `admin` user if the `users` table is empty. The password
comes from `ADMIN_PASSWORD` (env) and falls back to the well-known development
password — the same value the E2E tests use.
"""
from __future__ import annotations

import os

from scripts.seeders.base import SeedResult, get_logger, session_scope
from app.models.user import User
from app.services.auth import hash_password

ADMIN_USERNAME = "admin"
ADMIN_EMAIL = "admin@afamar.com.ar"
ADMIN_FULL_NAME = "Administrador"
# Defaults to the dev password when no env override is provided. Production
# deployments must override `ADMIN_PASSWORD` before first boot.
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")


def _seed_admin_once(reset_password: bool = False) -> SeedResult:
    logger = get_logger("seeders.users")
    result = SeedResult(seeder="users")
    with session_scope() as db:
        existing = db.query(User).filter(User.username == ADMIN_USERNAME).first()
        if existing is None:
            db.add(
                User(
                    username=ADMIN_USERNAME,
                    email=ADMIN_EMAIL,
                    hashed_password=hash_password(ADMIN_PASSWORD),
                    full_name=ADMIN_FULL_NAME,
                    is_active=True,
                    is_admin=True,
                )
            )
            result.inserted = 1
            logger.info("Created admin user '%s'", ADMIN_USERNAME)
        elif reset_password:
            existing.hashed_password = hash_password(ADMIN_PASSWORD)
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
