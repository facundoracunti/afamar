"""Backwards-compatible shim for the old `scripts/seed_materials.py`.

The real implementation has moved to `scripts/seeders/`. This module is
kept so the existing `python scripts/seed_materials.py` invocation (and
the `from scripts.seed_materials import ...` import in `app.main`)
continue to work. New code should import from `scripts.seeders` instead.

Deprecated: prefer `python -m scripts.seed` for the full seed orchestrator.
"""
from __future__ import annotations

import warnings

from scripts.seeders import seed_categories, seed_materials, seed_settings

warnings.warn(
    "scripts.seed_materials is deprecated, use scripts.seeders instead",
    DeprecationWarning,
    stacklevel=2,
)


def seed_default_settings() -> None:
    """Deprecated: use `seed_settings()` from `scripts.seeders`."""
    seed_settings()


__all__ = ["seed_categories", "seed_materials", "seed_default_settings"]
