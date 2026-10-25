"""Start a disposable API for the croquis E2E checks.

This server deliberately does not use the application's lifespan, Alembic, or
seeders. It creates the ORM schema in a brand-new SQLite file under the system
temporary directory and overrides the API database dependency with that engine.
It must never be pointed at an existing database.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from uvicorn import run

from app.api.dependencies import get_db
from app.api.routers.router import router as api_router
from app.db.base import Base
from app.models import *  # noqa: F401, F403


def build_app() -> tuple[FastAPI, Path]:
    temp_root = Path(tempfile.mkdtemp(prefix="afamar-sketch-e2e-"))
    db_path = temp_root / "isolated.sqlite3"
    system_temp = Path(tempfile.gettempdir()).resolve()
    if system_temp not in db_path.resolve().parents:
        raise RuntimeError(f"Refusing non-temporary database path: {db_path}")
    if db_path.exists():
        raise RuntimeError(f"Refusing to reuse database: {db_path}")

    database_url = f"sqlite:///{db_path}"
    engine = create_engine(database_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def isolated_get_db():
        db = session_local()
        try:
            yield db
        finally:
            db.close()

    app = FastAPI(title="AFAMAR isolated sketch E2E")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3190"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router)
    app.dependency_overrides[get_db] = isolated_get_db

    @app.get("/health")
    def health():
        return {"status": "ok", "database": database_url}

    return app, db_path


if __name__ == "__main__":
    os.environ["RATE_LIMIT_ENABLED"] = "false"
    isolated_app, isolated_db_path = build_app()
    print(f"ISOLATED_DATABASE={isolated_db_path}", flush=True)
    print("ISOLATED_DATABASE_SCHEMA=ORM metadata create_all (no Alembic)", flush=True)
    port = int(os.environ.get("ISOLATED_PORT", "3195"))
    run(isolated_app, host="127.0.0.1", port=port, log_level="warning")
