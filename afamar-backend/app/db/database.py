import logging

from .session import SessionLocal, engine

logger = logging.getLogger(__name__)


def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
