import logging
from .session import SessionLocal, engine

logger = logging.getLogger(__name__)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def dispose_db():
    engine.dispose()
