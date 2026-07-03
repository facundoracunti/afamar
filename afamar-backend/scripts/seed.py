"""Top-level seed orchestrator.

Runs every idempotent seeder in dependency order. Each seeder is safe to
re-run; missing rows are inserted and existing rows are left untouched.

Usage:
    python -m scripts.seed                       # seed everything
    python -m scripts.seed --reset-admin-password   # also reset admin password
    python -m scripts.seed --only users,materials    # comma-separated subset
"""
from __future__ import annotations

import argparse
import logging
import sys
from dataclasses import asdict
from typing import Callable

# Allow `python scripts/seed.py` from the backend root.
sys.path.insert(0, ".")

from scripts.seeders import (  # noqa: E402
    SeedResult,
    seed_categories,
    seed_materials,
    seed_settings,
    seed_users,
)


_SEEDERS: dict[str, Callable[..., SeedResult]] = {
    "users":      seed_users,
    "categories": seed_categories,
    "materials":  seed_materials,
    "settings":   seed_settings,
}

# Logical order: settings + categories first (no FKs depend on them), then
# materials (depends on categories), then users (independent).
DEFAULT_ORDER: tuple[str, ...] = ("settings", "categories", "materials", "users")


def run_all(only: list[str] | None = None, reset_admin_password: bool = False) -> list[SeedResult]:
    """Run every requested seeder and return the list of results."""
    selected = only or list(DEFAULT_ORDER)
    unknown = [name for name in selected if name not in _SEEDERS]
    if unknown:
        raise SystemExit(f"Unknown seeder(s): {', '.join(unknown)}. Available: {', '.join(_SEEDERS)}")

    order = [name for name in DEFAULT_ORDER if name in selected]
    results: list[SeedResult] = []
    for name in order:
        if name == "users" and reset_admin_password:
            results.append(_SEEDERS[name](reset_password=True))
        else:
            results.append(_SEEDERS[name]())
    return results


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    parser = argparse.ArgumentParser(description="Seed AFAMAR database (idempotent).")
    parser.add_argument(
        "--only",
        help=f"Comma-separated subset of seeders. Available: {', '.join(_SEEDERS)}",
    )
    parser.add_argument(
        "--reset-admin-password",
        action="store_true",
        help="Reset the admin user password (dev convenience).",
    )
    args = parser.parse_args()
    only = [s.strip() for s in args.only.split(",")] if args.only else None
    results = run_all(only=only, reset_admin_password=args.reset_admin_password)

    print("\n" + "=" * 60)
    print("Seed summary")
    print("=" * 60)
    for r in results:
        status = "OK" if r.ok else f"ERROR ({len(r.errors)})"
        print(
            f"  {r.seeder:<12} {status:<10} "
            f"inserted={r.inserted:<3} updated={r.updated:<3} skipped={r.skipped}"
        )
        for err in r.errors:
            print(f"    - {err}")
    print("=" * 60)

    return 0 if all(r.ok for r in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
