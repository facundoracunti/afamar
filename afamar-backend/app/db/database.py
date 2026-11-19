import logging

# Export both handles from the historical module path. The application
# lifespan imports `engine` here for its read-only health check, while API
# dependencies use `SessionLocal`.
from .session import SessionLocal, engine

__all__ = ["SessionLocal", "engine", "get_db"]

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
