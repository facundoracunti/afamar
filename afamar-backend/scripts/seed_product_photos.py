"""Seed initial data: admin user + product photos.

Usage:
    python scripts/seed_product_photos.py                    # seed admin + photos
    python scripts/seed_product_photos.py --admin-only       # only admin user
    python scripts/seed_product_photos.py --photos-only      # only product photos
    python scripts/seed_product_photos.py --force            # recreate admin even if exists
"""
import argparse
import logging
import sys

sys.path.insert(0, ".")

from pathlib import Path

from app.db.database import SessionLocal
from app.models.product_photo import ProductPhoto
from app.models.user import User
from app.services.auth import hash_password
from app.services.product_photo import ALLOWED_EXTENSIONS, ProductPhotoService

logger = logging.getLogger(__name__)

ADMIN_USERNAME = "admin"
ADMIN_EMAIL = "admin@afamar.com.ar"
ADMIN_PASSWORD = "admin123"
ADMIN_FULL_NAME = "Administrador"

PHOTO_TITLES = [
    "Mesada de cocina",
    "Mesada de baño",
    "Cubierta de granito",
    "Revestimiento de pared",
    "Mesada con bacha integrada",
    "Detalle de terminación",
    "Cocina completa",
    "Baño completo",
    "Mesada de cuarzo",
    "Detalle de junta",
    "Revestimiento exterior",
    "Trabajo especial",
]


def seed_admin(force: bool = False) -> int:
    """Create or update the admin user. Returns 1 if created, 0 if unchanged."""
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == ADMIN_USERNAME).first()

        if existing and not force:
            logger.info("Admin user '%s' already exists (id=%s) — skipped", ADMIN_USERNAME, existing.id)
            return 0

        if existing and force:
            existing.hashed_password = hash_password(ADMIN_PASSWORD)
            existing.is_active = True
            existing.is_admin = True
            db.commit()
            logger.info("Admin user '%s' updated (password reset)", ADMIN_USERNAME)
            return 0

        user = User(
            username=ADMIN_USERNAME,
            email=ADMIN_EMAIL,
            hashed_password=hash_password(ADMIN_PASSWORD),
            full_name=ADMIN_FULL_NAME,
            is_active=True,
            is_admin=True,
        )
        db.add(user)
        db.commit()
        logger.info("Admin user '%s' created (id=%s)", ADMIN_USERNAME, user.id)
        return 1
    except Exception:
        db.rollback()
        logger.exception("Failed to seed admin user")
        return -1
    finally:
        db.close()


def seed_product_photos(seed_dir: Path) -> int:
    """Seed product photos from a directory. Returns count of photos seeded."""
    db = SessionLocal()
    try:
        if db.query(ProductPhoto).first():
            logger.info("Product photos already exist — skipping")
            return 0

        if not seed_dir.exists():
            logger.warning("Seed dir %s not found — skipping", seed_dir)
            return 0

        images = sorted(
            p for p in seed_dir.glob("*") if p.suffix.lower() in ALLOWED_EXTENSIONS
        )
        if not images:
            logger.warning("No valid images found in %s — skipping", seed_dir)
            return 0

        service = ProductPhotoService(db)
        count = 0
        for i, src_path in enumerate(images):
            title = PHOTO_TITLES[i % len(PHOTO_TITLES)]
            with open(src_path, "rb") as f:
                file_data = f.read()
            service.create(
                file_data=file_data,
                filename=src_path.name,
                title=title,
            )
            count += 1
            logger.info("Seeded photo %d/%d: %s", count, len(images), src_path.name)

        logger.info("Seeded %d product photos", count)
        return count
    except Exception:
        db.rollback()
        logger.exception("Failed to seed product photos")
        return -1
    finally:
        db.close()


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    parser = argparse.ArgumentParser(description="Seed initial data (admin + product photos)")
    parser.add_argument("--force", action="store_true", help="Recreate admin user even if exists")
    parser.add_argument("--admin-only", action="store_true", help="Only seed admin user")
    parser.add_argument("--photos-only", action="store_true", help="Only seed product photos")
    parser.add_argument(
        "--dir",
        default=None,
        help="Path to seed images directory (default: seed/product_photos/)",
    )
    args = parser.parse_args()

    seed_admin_result = 0
    seed_photos_result = 0

    if not args.photos_only:
        logger.info("Seeding admin user...")
        seed_admin_result = seed_admin(force=args.force)

    if not args.admin_only:
        if args.dir:
            seed_dir = Path(args.dir).resolve()
        else:
            seed_dir = (
                Path(__file__).resolve().parent.parent / "seed" / "product_photos"
            )
        logger.info("Seeding product photos from %s", seed_dir)
        seed_photos_result = seed_product_photos(seed_dir)

    has_error = seed_admin_result < 0 or seed_photos_result < 0
    if has_error:
        logger.error("Seed completed with errors")
        return 1

    logger.info("Seed complete — admin: %s, photos: %s",
                "created" if seed_admin_result > 0 else "ok",
                f"{seed_photos_result} seeded" if seed_photos_result > 0 else "ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
