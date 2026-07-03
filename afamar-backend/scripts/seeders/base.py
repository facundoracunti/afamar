"""Shared utilities for all seeders.

Every seeder in `scripts/seeders/` is:
  - idempotent (safe to re-run),
  - typed (Python 3.14 PEP 604 unions + `Mapped`/`mapped_column` SQLAlchemy 2.0),
  - using the structured logger (no `print()`),
  - returning a `SeedResult` so the top-level runner can summarise.
"""
from __future__ import annotations

import logging
import sys
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Callable, Iterator, TypeVar

from sqlalchemy.orm import Session

from app.db.database import SessionLocal

T = TypeVar("T")


@dataclass
class SeedResult:
    """Summary returned by every seeder."""

    seeder: str
    inserted: int = 0
    updated: int = 0
    skipped: int = 0
    errors: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.errors

    @property
    def total_changed(self) -> int:
        return self.inserted + self.updated


def get_logger(name: str) -> logging.Logger:
    """Get a logger that emits the standard AFAMAR format even when the seeder
    runs outside `app.main` (which is what configures the root logger)."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(stream=sys.stdout)
        handler.setFormatter(
            logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
        )
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False
    return logger


@contextmanager
def session_scope() -> Iterator[Session]:
    """Context manager for a transactional DB session.

    Commits on success, rolls back on exception, always closes the session.
    Replaces the repeated `db = SessionLocal(); try: ...; finally: db.close()`
    pattern across the old seeders.
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def upsert_by_name(
    db: Session,
    model: type[T],
    name: str,
    defaults: dict,
    *,
    update_fields: tuple[str, ...] = (),
) -> tuple[T, bool]:
    """Get-or-create helper keyed on the `name` column.

    Returns `(instance, created)`. When `update_fields` is provided and a row
    already exists, those fields are refreshed in-place (handy for `--force`
    label updates).
    """
    instance = db.query(model).filter(model.name == name).first()  # type: ignore[attr-defined]
    if instance is None:
        instance = model(name=name, **defaults)
        db.add(instance)
        db.flush()
        return instance, True
    if update_fields:
        for field_name in update_fields:
            if field_name in defaults:
                setattr(instance, field_name, defaults[field_name])
        db.flush()
    return instance, False


def run_seeder(name: str, fn: Callable[[], SeedResult]) -> SeedResult:
    """Top-level helper: run a seeder, log any errors, return the result.

    Used by the main `scripts/seed.py` orchestrator.
    """
    logger = get_logger(name)
    try:
        result = fn()
        if result.errors:
            for err in result.errors:
                logger.error("%s: %s", name, err)
        logger.info(
            "%s: %d inserted, %d updated, %d skipped",
            name, result.inserted, result.updated, result.skipped,
        )
        return result
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("%s failed", name)
        return SeedResult(seeder=name, errors=[str(exc)])
