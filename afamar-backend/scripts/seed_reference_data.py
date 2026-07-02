"""Seed reference data (statuses, payment methods, priority levels, finish types).

Loads canonical Spanish labels for the AFAMAR admin panel. Idempotent:
running this script multiple times will not create duplicates — items are
matched by `name`, and existing rows are skipped.

Usage:
    python -m scripts.seed_reference_data        # seed all (skip existing)
    python -m scripts.seed_reference_data --force  # update labels on existing
    python -m scripts.seed_reference_data --only budget_statuses
    python -m scripts.seed_reference_data --only payment_methods

The script is safe to run on a populated database — it only inserts rows
that are missing, and (with --force) optionally updates `label`, `color`
and `sort_order` on existing rows without changing their `name`.
"""
import argparse
import sys
from typing import Iterable

# Allow running both as `python scripts/seed_reference_data.py` and
# `python -m scripts.seed_reference_data` from the project root.
sys.path.insert(0, ".")

from app.db.database import SessionLocal  # noqa: E402
from app.models.reference import (  # noqa: E402
    BudgetStatus,
    FinishType,
    PaymentMethod,
    PriorityLevel,
    WorkOrderStatus,
)


# --- Reference data ---------------------------------------------------------

# Each entry: (name, label, color, sort_order)
# The `name` is the stable English key (used in code/DB filters).
# The `label` is the human-readable Spanish display name.
# The `color` is the optional hex color used in UI badges.

BUDGET_STATUSES: list[tuple[str, str, str | None, int]] = [
    ("PENDING",         "Pendiente",       "#f59e0b", 0),
    ("ONLINE",          "Online",          "#0ea5e9", 1),
    ("APPROVED",        "Aprobado",        "#16a34a", 2),
    ("REJECTED",        "Rechazado",       "#dc2626", 3),
    ("CONVERTED_TO_OT", "Convertido a OT", "#7c3aed", 4),
]

WORK_ORDER_STATUSES: list[tuple[str, str, str | None, int]] = [
    ("MEASUREMENT", "Medición",  "#0ea5e9", 0),
    ("WORKSHOP",    "Taller",    "#f59e0b", 1),
    ("FINISHED",    "Terminado", "#16a34a", 2),
    ("DELIVERED",   "Entregado", "#7c3aed", 3),
    ("CANCELLED",   "Cancelado", "#6b7280", 4),
]

PAYMENT_METHODS: list[tuple[str, str, str | None, int]] = [
    ("CASH",         "Efectivo",          "#16a34a", 0),
    ("TRANSFER",     "Transferencia",     "#0ea5e9", 1),
    ("CREDIT_CARD",  "Tarjeta de Crédito","#7c3aed", 2),
    ("DEBIT_CARD",   "Tarjeta de Débito", "#a855f7", 3),
    ("CHECK",        "Cheque",            "#f59e0b", 4),
    ("MIXED",        "Mixto",             "#6b7280", 5),
]

PRIORITY_LEVELS: list[tuple[str, str, str | None, int]] = [
    ("LOW",    "Baja",    "#6b7280", 0),
    ("NORMAL", "Normal",  "#0ea5e9", 1),
    ("HIGH",   "Alta",    "#f59e0b", 2),
    ("URGENT", "Urgente", "#dc2626", 3),
]

FINISH_TYPES: list[tuple[str, str, str | None, int]] = [
    ("POLISHED",   "Pulido",     "#0ea5e9", 0),
    ("HONED",      "Apomazado",  "#16a34a", 1),
    ("BUSHED",     "Abujardado", "#f59e0b", 2),
    ("FLAMED",     "Llameado",   "#dc2626", 3),
    ("SAND",       "Arénado",    "#7c3aed", 4),
    ("LEATHERED",  "Cuero",      "#a855f7", 5),
]


RESOURCES: dict[str, tuple[type, list[tuple[str, str, str | None, int]]]] = {
    "budget_statuses":   (BudgetStatus,     BUDGET_STATUSES),
    "work_order_statuses": (WorkOrderStatus,  WORK_ORDER_STATUSES),
    "payment_methods":   (PaymentMethod,     PAYMENT_METHODS),
    "priority_levels":   (PriorityLevel,     PRIORITY_LEVELS),
    "finish_types":      (FinishType,        FINISH_TYPES),
}


def upsert(
    db,
    model: type,
    rows: Iterable[tuple[str, str, str | None, int]],
    *,
    force: bool = False,
) -> tuple[int, int]:
    """Insert missing rows; optionally update existing ones.

    Models that lack a `color` column (PaymentMethod, FinishType) will
    have their `color` argument dropped automatically. Returns
    (inserted, updated) counts.
    """
    has_color = hasattr(model, "color")
    inserted = 0
    updated = 0
    for name, label, color, sort_order in rows:
        existing = db.query(model).filter(model.name == name).first()
        if existing is None:
            payload = {
                "name": name,
                "label": label,
                "sort_order": sort_order,
                "is_active": True,
            }
            if has_color:
                payload["color"] = color
            db.add(model(**payload))
            inserted += 1
        elif force:
            existing.label = label
            existing.sort_order = sort_order
            if has_color:
                existing.color = color
            updated += 1
    db.commit()
    return inserted, updated


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed reference data for AFAMAR")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Update label/color/sort_order on existing rows too",
    )
    parser.add_argument(
        "--only",
        choices=list(RESOURCES.keys()),
        help="Only seed this resource (default: all)",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        targets = (
            {args.only: RESOURCES[args.only]}
            if args.only
            else RESOURCES
        )
        total_inserted = 0
        total_updated = 0
        for name, (model, rows) in targets.items():
            ins, upd = upsert(db, model, rows, force=args.force)
            total_inserted += ins
            total_updated += upd
            action = "inserted" if not args.force else "inserted/updated"
            print(f"  {name:<22} → {ins} {action}" + (f", {upd} updated" if args.force else ""))
        verb = "seeded" if not args.force else "upserted"
        print(
            f"\nDone. {verb} {total_inserted} rows"
            + (f", updated {total_updated} rows." if args.force else ".")
        )
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
