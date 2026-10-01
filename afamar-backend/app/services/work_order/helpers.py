"""Shared helpers for the work-order package.

Module-level utilities used by the service orchestrator (``__init__``),
``recalc.py``, ``snapshots.py`` and ``conversion.py``. Kept here so the
public ``WorkOrderService`` stays focused on CRUD + status transitions and
the heavy lifting lives in dedicated modules.
"""
import json
from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.work_order import WorkOrder


# Fabrication-detail concept names that are measured in m² (length × width
# × quantity). Mirrors the frontend ``M2_CONCEPTS`` in
# ``features/budgets/utils/fabricationDetails.ts``. Used by
# ``snapshots.py`` to bake the right snapshot key into each piece row.
FAB_M2_CONCEPTS = {"LENGTH", "BASEBOARD", "FRONT", "LARGO", "ZOCALOS", "FRENTE"}

# Fabrication-detail concept names that are measured in ml (length ×
# quantity). Same source of truth as the frontend.
FAB_LINEAR_CONCEPTS = {"TERMINACION"}


def stash_sketch_into_budgeted_details(data: dict) -> None:
    """Mirror the ``sketch_elements`` payload into the legacy
    ``budgeted_details`` TEXT column so the legacy xhtml2pdf path keeps
    working (it reads ``budgeted_details`` for the sketch source).

    The new ``WorkOrder.sketch_elements`` TEXT column is the source of
    truth for the modern PDF renderer and the WO form, so we keep
    ``data["sketch_elements"]`` as-is and just ADD ``budgeted_details``
    alongside it when missing.

    Accepts the sketch in three shapes that the frontend / conversion
    path have produced over time:
      1. JSON-encoded string (current ``buildPayload`` + the conversion
         path's ``create_from_budget``).
      2. Plain array of ``{type, data, order}`` (older ``buildPayload``
         versions, kept for backward compat).
      3. None / empty (no-op).

    Mutates ``data`` in place.
    """
    sketch = data.get("sketch_elements")
    if not sketch:
        return
    if isinstance(sketch, str):
        # JSON-encoded: mirror as-is to budgeted_details (it's the same
        # canonical string the new column already stores).
        data.setdefault("budgeted_details", sketch or None)
        return
    if not isinstance(sketch, list):
        return
    # Plain array: serialise to JSON, set BOTH the new column and the
    # legacy column so the legacy PDF still finds it.
    try:
        encoded = json.dumps(sketch, ensure_ascii=False)
    except (TypeError, ValueError):
        return
    data["sketch_elements"] = encoded
    data.setdefault("budgeted_details", encoded)


def deposit_native_amount(order: "WorkOrder") -> float:
    """Native seña amount in the currency the deposit was registered in.

    The form keeps ``deposit_received`` (ARS) and ``deposit_usd`` (USD) as
    parallel columns and toggles which one carries the native value via
    ``deposit_currency``. For a USD seña ``deposit_received`` is 0, so booking
    that as the income would silently skip the movement.
    """
    if (order.deposit_currency or "").upper() == "USD":
        return float(order.deposit_usd or 0)
    return float(order.deposit_received or 0)


def update_client_total_purchased(db: Session, client_id: int):
    from sqlalchemy import func
    total = (
        db.query(func.coalesce(func.sum(WorkOrder.total), 0))
        .filter(WorkOrder.client_id == client_id, WorkOrder.status == "FINISHED")
        .scalar()
    )
    db.query(Client).filter(Client.id == client_id).update({"total_purchased": total})
    db.flush()
