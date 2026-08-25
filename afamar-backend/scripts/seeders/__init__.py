"""Public surface of the seeders package.

All seeders are importable as:

    from scripts.seeders import seed_users, seed_categories, seed_materials

…and runnable standalone via `python -m scripts.seed` (top-level orchestrator).
"""
from scripts.seeders.additional_works import seed_additional_works
from scripts.seeders.base import SeedResult
from scripts.seeders.categories import seed_categories
from scripts.seeders.colors import seed_colors
from scripts.seeders.materials import seed_materials
from scripts.seeders.payment_methods import seed_payment_methods
from scripts.seeders.pool_stock import seed_pool_stock
from scripts.seeders.pool_types import seed_pool_types
from scripts.seeders.settings import seed_settings
from scripts.seeders.users import seed_users

__all__ = [
    "SeedResult",
    "seed_additional_works",
    "seed_categories",
    "seed_colors",
    "seed_materials",
    "seed_payment_methods",
    "seed_pool_stock",
    "seed_pool_types",
    "seed_settings",
    "seed_users",
]
