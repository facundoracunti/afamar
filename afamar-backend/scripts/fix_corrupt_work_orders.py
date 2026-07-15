#!/usr/bin/env python3
"""Diagnose and fix corrupted work_order rows.

Usage:
    python scripts/fix_corrupt_work_orders.py              # dry-run, report only
    python scripts/fix_corrupt_work_orders.py --fix        # apply automatic fixes
    python scripts/fix_corrupt_work_orders.py --fix --interactive  # confirm each fix
"""

import argparse
import json
import sys
from pathlib import Path

# Add project root to path so we can import app modules
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text
from app.core.settings import settings
from app.db.session import SessionLocal
from app.models.work_order import WorkOrder
from app.models.client import Client
from app.models.client_address import ClientAddress


JSON_COLUMNS = [
    "materials_data",
    "pools_data",
    "fabrication_details",
    "additional_works_data",
    "sketch_elements",
]


def check_json_field(value):
    """Return (ok, error_msg) for a JSON TEXT column."""
    if value is None or value == "":
        return True, None
    if not isinstance(value, str):
        return False, f"expected str, got {type(value).__name__}"
    try:
        parsed = json.loads(value)
        if not isinstance(parsed, (list, dict)):
            return False, f"parsed to {type(parsed).__name__}, expected list or dict"
    except (json.JSONDecodeError, ValueError) as exc:
        return False, f"JSON parse error: {exc}"
    return True, None


def check_fk_exists(db, table, fk_id):
    """Return True if a row with the given ID exists in the table."""
    if fk_id is None:
        return True
    result = db.execute(text(f"SELECT 1 FROM {table} WHERE id = :id"), {"id": fk_id}).fetchone()
    return result is not None


def diagnose(db):
    """Check every work_order row for issues. Returns list of dicts."""
    problems = []
    orders = db.query(WorkOrder).all()

    for o in orders:
        row_issues = []

        # 1. Check JSON columns
        for col in JSON_COLUMNS:
            val = getattr(o, col, None)
            ok, msg = check_json_field(val)
            if not ok:
                row_issues.append({
                    "type": "json_corrupt",
                    "column": col,
                    "detail": msg,
                    "value_preview": str(val)[:120] if val else None,
                })

        # 2. Check client_id FK
        if o.client_id and not check_fk_exists(db, "clients", o.client_id):
            row_issues.append({
                "type": "fk_orphan",
                "column": "client_id",
                "detail": f"client_id={o.client_id} does not exist in clients table",
                "value_preview": str(o.client_id),
            })

        # 3. Check delivery_address_id FK
        if o.delivery_address_id and not check_fk_exists(db, "client_addresses", o.delivery_address_id):
            row_issues.append({
                "type": "fk_orphan",
                "column": "delivery_address_id",
                "detail": f"delivery_address_id={o.delivery_address_id} does not exist in client_addresses table",
                "value_preview": str(o.delivery_address_id),
            })

        # 4. Check budget_id FK
        if o.budget_id and not check_fk_exists(db, "budgets", o.budget_id):
            row_issues.append({
                "type": "fk_orphan",
                "column": "budget_id",
                "detail": f"budget_id={o.budget_id} does not exist in budgets table",
                "value_preview": str(o.budget_id),
            })

        # 5. Try Pydantic serialization (catches type mismatches, unexpected NULLs, etc.)
        try:
            from app.schemas.work_order import WorkOrderResponse
            WorkOrderResponse.from_orm_with_client(o)
        except Exception as exc:
            # Avoid duplicating issues already caught above
            already_caught = any(
                iss["type"] == "serialization" for iss in row_issues
            )
            if not already_caught:
                row_issues.append({
                    "type": "serialization",
                    "column": None,
                    "detail": f"{type(exc).__name__}: {exc}",
                    "value_preview": None,
                })

        if row_issues:
            problems.append({
                "id": o.id,
                "number": o.number,
                "status": o.status,
                "issues": row_issues,
            })

    return problems


def print_report(problems):
    """Print a human-readable report."""
    if not problems:
        print("\n  All work orders are healthy. No issues found.\n")
        return

    print(f"\n  Found {len(problems)} work order(s) with issues:\n")
    for p in problems:
        print(f"  ┌─ WorkOrder #{p['number']} (id={p['id']}, status={p['status']})")
        for iss in p["issues"]:
            col_str = f" [{iss['column']}]" if iss["column"] else ""
            print(f"  │  {iss['type']}{col_str}: {iss['detail']}")
            if iss["value_preview"]:
                print(f"  │    value: {iss['value_preview']}")
        print(f"  └──────────────────────────────────────────────")
    print()


def fix_problems(db, problems, interactive=False):
    """Apply automatic fixes for known issue types."""
    fixed = 0

    for p in problems:
        order = db.query(WorkOrder).filter(WorkOrder.id == p["id"]).first()
        if not order:
            continue

        for iss in p["issues"]:
            fix_desc = None
            fix_fn = None

            if iss["type"] == "json_corrupt":
                col = iss["column"]
                fix_desc = f"Set {col} = NULL (corrupt JSON)"
                fix_fn = lambda c=col: setattr(order, c, None)

            elif iss["type"] == "fk_orphan":
                col = iss["column"]
                if col == "delivery_address_id":
                    fix_desc = f"Set delivery_address_id = NULL (FK orphan)"
                    fix_fn = lambda: setattr(order, "delivery_address_id", None)
                elif col == "client_id":
                    fix_desc = f"SKIP — client_id orphan requires manual decision"
                    fix_fn = None
                elif col == "budget_id":
                    fix_desc = f"Set budget_id = NULL (FK orphan)"
                    fix_fn = lambda: setattr(order, "budget_id", None)

            if fix_desc and fix_fn:
                if interactive:
                    print(f"  Fix #{order.number} (id={order.id}): {fix_desc}")
                    answer = input("  Apply? [y/N] ").strip().lower()
                    if answer != "y":
                        print("  Skipped.\n")
                        continue
                else:
                    print(f"  Fixing #{order.number} (id={order.id}): {fix_desc}")

                fix_fn()
                fixed += 1

    if fixed > 0:
        db.commit()
        print(f"\n  Applied {fixed} fix(es). Re-run without --fix to verify.\n")
    else:
        print("\n  No fixes applied.\n")

    return fixed


def main():
    parser = argparse.ArgumentParser(
        description="Diagnose and fix corrupted work_order rows."
    )
    parser.add_argument(
        "--fix", action="store_true",
        help="Apply automatic fixes (dry-run by default)"
    )
    parser.add_argument(
        "--interactive", action="store_true",
        help="Ask for confirmation before each fix (requires --fix)"
    )
    args = parser.parse_args()

    if args.interactive and not args.fix:
        parser.error("--interactive requires --fix")

    print(f"\n  Database: {settings.DATABASE_URL_SAFE}")
    print(f"  Environment: {settings.ENVIRONMENT}")

    db = SessionLocal()
    try:
        problems = diagnose(db)
        print_report(problems)

        if args.fix and problems:
            fix_problems(db, problems, interactive=args.interactive)
    finally:
        db.close()


if __name__ == "__main__":
    main()
