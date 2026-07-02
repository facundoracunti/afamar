import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from alembic import command
from alembic.config import Config as AlembicConfig
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.routers.router import router as api_router
from app.core.settings import settings
from app.utils.logger import setup_logging, check_database
from app.utils.responses import error
from app.models import *  # noqa: F401, F403
setup_logging()
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])


def run_migrations():
    alembic_cfg = AlembicConfig("alembic.ini")
    try:
        command.upgrade(alembic_cfg, "head")
    except Exception:
        logger.warning("Alembic upgrade failed — stamping head instead", exc_info=True)
        try:
            command.stamp(alembic_cfg, "head")
        except Exception:
            logger.warning("Alembic stamp also failed", exc_info=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=" * 60)
    logger.info("Starting %s v%s", settings.APP_NAME, settings.APP_VERSION)
    logger.info("Environment: %s", settings.ENVIRONMENT)
    logger.info("Database: %s", settings.DATABASE_URL_SAFE)
    logger.info("Frontend URL: %s", settings.FRONTEND_URL)
    logger.info("-" * 60)
    
    ok, msg = check_database()
    if ok:
        logger.info("Database check: %s", msg)
    else:
        logger.error("Database check: %s", msg)
        raise RuntimeError(msg)
    run_migrations()
    try:
        from scripts.seed_materials import seed_materials, seed_default_settings
        seed_default_settings()
        seed_materials()
    except Exception as exc:
        logger.warning("Material seed failed: %s", exc)
    yield


app = FastAPI(title=settings.APP_NAME, version=settings.APP_VERSION, lifespan=lifespan)

if settings.RATE_LIMIT_ENABLED:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

app.include_router(api_router)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed = (time.perf_counter() - start) * 1000
    logger.info("%s %s — %s (%.0fms)", request.method, request.url.path, response.status_code, elapsed)
    return response


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_request: Request, exc: StarletteHTTPException):
    return error(detail=exc.detail, status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError):
    return error(detail=str(exc.errors()), status_code=422)


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request: Request, exc: Exception):
    logger.exception("Unhandled error")
    return error(detail="Internal server error", status_code=500)


@app.get("/health")
def health():
    return {"status": "ok", "version": settings.APP_VERSION}


@app.get("/health/ready")
def health_ready():
    ok, msg = check_database()
    if ok:
        return {"status": "ready", "database": "connected", "version": settings.APP_VERSION}
    return {"status": "not_ready", "database": msg, "version": settings.APP_VERSION}
