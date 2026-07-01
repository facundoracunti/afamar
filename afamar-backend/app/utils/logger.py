import logging
import sys
import time

from app.core.settings import settings

def setup_logging() -> None:
    level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        stream=sys.stdout,
    )

    if settings.DB_ECHO:
        logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO)

    logger = logging.getLogger("app")
    logger.info("Logging configured — level=%s, format=%s", settings.LOG_LEVEL, settings.LOG_FORMAT)

def check_database() -> tuple[bool, str]:
    from sqlalchemy import text
    from app.db.database import engine

    start = time.time()
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        elapsed = time.time() - start
        return True, f"connected ({elapsed:.3f}s)"
    except Exception as e:
        elapsed = time.time() - start
        return False, f"failed ({elapsed:.3f}s): {e}"