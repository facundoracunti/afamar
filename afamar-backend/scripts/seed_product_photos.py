"""Seed product photos from `seed/product_photos/`.

The admin user seeder has moved to `scripts.seeders.users`. This script
is now focused on the photo gallery seed.

Usage:
    python -m scripts.seed_product_photos                 # default dir
    python -m scripts.seed_product_photos --dir /path    # custom dir
"""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

# Allow `python scripts/seed_product_photos.py` from the backend root.
sys.path.insert(0, ".")

from app.db.database import SessionLocal  # noqa: E402
from app.models.product_photo import ProductPhoto  # noqa: E402
from app.services.product_photo import (  # noqa: E402
    ALLOWED_EXTENSIONS,
    ProductPhotoService,
)


logger = logging.getLogger("scripts.seed_product_photos")

PHOTO_TITLES: tuple[str, ...] = (
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
)


def seed_product_photos(seed_dir: Path) -> int:
    """Seed product photos from a directory.

    Returns:
        Number of new photos inserted. 0 when the table is already populated
        or when the directory has no images. -1 on error.
    """
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
                service.create(
                    file_data=f.read(),
                    filename=src_path.name,
                    title=title,
                )
            count += 1
            logger.info("Seeded photo %d/%d: %s", count, len(images), src_path.name)

        db.commit()
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
    parser = argparse.ArgumentParser(description="Seed product photos.")
    parser.add_argument(
        "--dir",
        default=None,
        help="Path to seed images directory (default: seed/product_photos/)",
    )
    args = parser.parse_args()

    if args.dir:
        seed_dir = Path(args.dir).resolve()
    else:
        seed_dir = Path(__file__).resolve().parent.parent / "seed" / "product_photos"

    logger.info("Seeding product photos from %s", seed_dir)
    result = seed_product_photos(seed_dir)
    if result < 0:
        return 1
    logger.info("Done. %s", f"{result} photos seeded" if result > 0 else "no changes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
