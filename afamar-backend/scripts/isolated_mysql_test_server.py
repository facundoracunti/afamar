"""Run AFAMAR against the disposable local MySQL test database only.

The guard runs before importing the application, so a misconfigured shell
cannot accidentally start the normal production database connection.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path


TEST_DATABASE = "afamar_test"
TEST_PORT = 3195


def configure_isolated_environment() -> None:
    if os.environ.get("AFAMAR_TEST_MODE") != "1":
        raise RuntimeError("Refusing to start: set AFAMAR_TEST_MODE=1 explicitly")

    requested_db = os.environ.get("DB_NAME")
    if requested_db not in (None, TEST_DATABASE):
        raise RuntimeError(f"Refusing database {requested_db!r}; expected {TEST_DATABASE!r}")

    requested_host = os.environ.get("DB_HOST")
    if requested_host not in (None, "localhost", "127.0.0.1", "::1"):
        raise RuntimeError(f"Refusing non-local DB_HOST {requested_host!r}")

    os.environ.update(
        {
            "ENVIRONMENT": "testing",
            "DB_NAME": TEST_DATABASE,
            "DB_HOST": "127.0.0.1",
            "DB_PORT": os.environ.get("DB_PORT", "3306"),
            "RATE_LIMIT_ENABLED": "false",
            "AFAMAR_TEST_DATABASE": TEST_DATABASE,
        }
    )


def main() -> None:
    configure_isolated_environment()

    backend_root = Path(__file__).resolve().parent.parent
    if str(backend_root) not in sys.path:
        sys.path.insert(0, str(backend_root))

    # Import after setting the environment: Settings reads the project .env at
    # import time, and the explicit testing values must take precedence.
    from app.core.settings import settings
    from app.main import app
    from uvicorn import run

    if (
        settings.ENVIRONMENT != "testing"
        or settings.DB_NAME != TEST_DATABASE
        or settings.DB_HOST != "127.0.0.1"
        or settings.DB_NAME == "afamar"
    ):
        raise RuntimeError(
            "Refusing to start: effective database is not the isolated afamar_test database"
        )

    print("AFAMAR_TEST_MODE=1", flush=True)
    print(f"AFAMAR_TEST_DATABASE={settings.DB_NAME}", flush=True)
    print(f"AFAMAR_TEST_PORT={TEST_PORT}", flush=True)
    run(app, host="127.0.0.1", port=TEST_PORT, log_level="warning")


if __name__ == "__main__":
    main()
