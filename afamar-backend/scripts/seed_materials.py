"""Seed material categories, colors, thicknesses, and common materials.

Idempotent: re-running won't duplicate rows. Safe to call on startup or manually.
"""
import logging
from pathlib import Path

from app.db.base import Base
from app.db.session import SessionLocal
from app.models.material import Material, MaterialCategory, MaterialColor, MaterialThickness
from app.models.price_history import PriceHistory
from app.models.setting import Setting

logger = logging.getLogger(__name__)


CATEGORIES = ["Granitos", "Cuarzos", "Sinterizados", "Mármoles"]

COLORS = [
    "Blanco", "Negro", "Gris", "Beige", "Crema",
    "Rojo", "Verde", "Azul", "Marrón", "Dorado", "Plateado",
]

THICKNESSES = ["1cm", "2cm", "3cm", "4cm", "6cm"]

COMMON_MATERIALS = [
    ("Granito Negro Absoluto", "Granitos", "Negro", "2cm", 45.0),
    ("Granito Blanco Dallas", "Granitos", "Blanco", "2cm", 50.0),
    ("Granito Gris Pulido", "Granitos", "Gris", "2cm", 40.0),
    ("Cuarzo Blanco Polar", "Cuarzos", "Blanco", "2cm", 70.0),
    ("Cuarzo Gris Oxford", "Cuarzos", "Gris", "2cm", 75.0),
    ("Cuarzo Beige", "Cuarzos", "Beige", "2cm", 65.0),
    ("Sinterizado Dekton", "Sinterizados", "Gris", "2cm", 100.0),
    ("Sinterizado Neolith", "Sinterizados", "Blanco", "2cm", 110.0),
    ("Mármol Travertino", "Mármoles", "Beige", "3cm", 60.0),
    ("Mármol Crema Marfil", "Mármoles", "Crema", "3cm", 55.0),
]


def seed_materials():
    db = SessionLocal()
    try:
        if not db.query(MaterialCategory).first():
            for name in CATEGORIES:
                db.add(MaterialCategory(name=name))
            db.flush()
            logger.info("Seeded %d material categories", len(CATEGORIES))

        if not db.query(MaterialColor).first():
            for c in COLORS:
                db.add(MaterialColor(name=c))
            db.flush()
            logger.info("Seeded %d colors", len(COLORS))

        if not db.query(MaterialThickness).first():
            for t in THICKNESSES:
                db.add(MaterialThickness(name=t))
            db.flush()
            logger.info("Seeded %d thicknesses", len(THICKNESSES))

        if not db.query(Material).first():
            cat_map = {row.name: row.id for row in db.query(MaterialCategory).all()}
            for name, cat_name, color, thickness, price in COMMON_MATERIALS:
                if cat_name not in cat_map:
                    logger.warning("Category %s not found, skipping material %s", cat_name, name)
                    continue
                m = Material(
                    name=name,
                    category_id=cat_map[cat_name],
                    color=color,
                    available_thickness=thickness,
                    base_price=price,
                )
                db.add(m)
                db.flush()
                db.add(PriceHistory(material_id=m.id, material_name=name, price_m2=price))
            db.flush()
            logger.info("Seeded %d common materials", len(COMMON_MATERIALS))

        db.commit()
        logger.info("Material seed completed successfully")
    except Exception:
        db.rollback()
        logger.exception("Material seed failed — all changes rolled back")
    finally:
        db.close()


def seed_default_settings():
    db = SessionLocal()
    try:
        if not db.query(Setting).first():
            for k, v in {
                "company_name": "AFAMAR",
                "company_address": "",
                "company_phone": "",
                "company_email": "",
                "company_logo": "",
                "pdf_footer": "",
                "budget_terms": "",
                "delivery_terms": "",
                "warranty_text": "",
                "observaciones_automaticas": "",
            }.items():
                db.add(Setting(key=k, value=v))
            db.commit()
            logger.info("Seeded default settings")
    except Exception:
        db.rollback()
        logger.exception("Settings seed failed")
    finally:
        db.close()


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    Base.metadata.create_all(bind=SessionLocal().get_bind())
    seed_default_settings()
    seed_materials()
