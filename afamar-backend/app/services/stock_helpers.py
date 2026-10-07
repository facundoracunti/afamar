import json

from sqlalchemy.orm import Session

from app.models.pool_stock import PoolStock, StockMovement


def deduct_pool_stock(db: Session, pool_id: int | None, pools_data: str | None, source_number: str):
    """Decrement pool stock quantities AND record outgoing movements.

    Called when a work order is created or when pool stock is consumed.
    Uses `with_for_update` to prevent double-deduction under concurrent
    requests (pessimistic lock on the PoolStock row).

    The two changes (pool.quantity subtraction + new StockMovement row)
    are applied in the same session and committed together by the caller
    (the `commit_pool_stock_changes` helper guarantees both are
    persisted atomically — see below).

    The StockMovement note uses the same prefix as the legacy pool stock
    ("Salida por producción - <OT-number>") so the Movimientos modal
    shows a single, recognisable format across every pileta in the
    catalogue — previously this helper wrote "Consumo por fabricación"
    which made NEW pileta movements look out of place next to historical
    ones. ``source_number`` is the OT's own number (NOT the source
    budget's), so the link is to the document that consumed the stock.
    """
    pools_deducted = set()
    if pool_id and pool_id not in pools_deducted:
        pool = db.query(PoolStock).filter(PoolStock.id == pool_id).with_for_update().first()
        if pool and (pool.quantity or 0) > 0:
            # EXPLICIT subtraction: `pool.quantity -= qty`. The `>` guard
            # above keeps the value from going negative; if the operator
            # is somehow trying to deduct from a 0-quantity pool we skip
            # the row entirely (the StockMovement is also skipped so the
            # inventory log doesn't lie about a phantom exit).
            pool.quantity -= 1
            movement = StockMovement(
                pool_id=pool.id,
                type="exit",
                quantity=1,
                notes=f"Salida por producción - {source_number}",
            )
            db.add(movement)
        pools_deducted.add(pool_id)

    if pools_data:
        try:
            pools_list = json.loads(pools_data) if isinstance(pools_data, str) else pools_data
            for entry in pools_list if isinstance(pools_list, list) else []:
                pid = entry.get("pool_id") or entry.get("id")
                qty = entry.get("quantity", 1)
                if pid and pid not in pools_deducted:
                    pool = db.query(PoolStock).filter(PoolStock.id == pid).with_for_update().first()
                    if pool and (pool.quantity or 0) >= qty:
                        # EXPLICIT subtraction (see comment above).
                        pool.quantity -= qty
                        movement = StockMovement(
                            pool_id=pool.id,
                            type="exit",
                            quantity=qty,
                            notes=f"Salida por producción - {source_number}",
                        )
                        db.add(movement)
                    pools_deducted.add(pid)
        except (json.JSONDecodeError, TypeError):
            pass


def commit_pool_stock_changes(db: Session) -> None:
    """Atomically commit any pending pool-quantity change + new StockMovement.

    The caller calls this after `deduct_pool_stock` / `restore_pool_stock`
    so both the column update and the new movement row land in the same
    transaction. Returning instead of taking a `db.flush()` keeps the
    control of the transaction lifecycle with the service orchestrator
    (WorkOrderService.create / create_from_budget / update already wrap
    this in the same `db.commit()` as the OT insert / status flip).
    """
    db.commit()


def restore_pool_stock(db: Session, pool_id: int | None, pools_data: str | None, source_number: str, notes_prefix: str = "Entrada por producción"):
    """Restore pool stock quantities AND record incoming movements.

    Called when a budget is deleted (undoes the stock deduction) or a
    work order is cancelled. Uses `with_for_update` to prevent races.
    The ``notes_prefix`` defaults to "Entrada por producción" to mirror
    the legacy format ("Salida por producción" on the deduction side);
    callers can override it (e.g. "Entrada por cancelación" when the
    trigger is a WO cancellation).
    """
    pools_restored = set()
    if pool_id and pool_id not in pools_restored:
        pool = db.query(PoolStock).filter(PoolStock.id == pool_id).with_for_update().first()
        if pool:
            # EXPLICIT addition (see `deduct_pool_stock` for the matching
            # `pool.quantity -=` pattern).
            pool.quantity += 1
            movement = StockMovement(
                pool_id=pool.id,
                type="entry",
                quantity=1,
                notes=f"{notes_prefix} - {source_number}",
            )
            db.add(movement)
        pools_restored.add(pool_id)

    if pools_data:
        try:
            pools_list = json.loads(pools_data) if isinstance(pools_data, str) else pools_data
            for entry in pools_list if isinstance(pools_list, list) else []:
                pid = entry.get("pool_id") or entry.get("id")
                qty = entry.get("quantity", 1)
                if pid and pid not in pools_restored:
                    pool = db.query(PoolStock).filter(PoolStock.id == pid).with_for_update().first()
                    if pool:
                        # EXPLICIT addition (matches the deduction above).
                        pool.quantity += qty
                        movement = StockMovement(
                            pool_id=pool.id,
                            type="entry",
                            quantity=qty,
                            notes=f"{notes_prefix} - {source_number}",
                        )
                        db.add(movement)
                    pools_restored.add(pid)
        except (json.JSONDecodeError, TypeError):
            pass
