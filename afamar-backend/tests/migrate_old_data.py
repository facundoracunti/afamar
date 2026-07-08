"""Migrate data from old Spanish schema to new English schema.

Run this AFTER the new backend has started once (so Alembic creates the empty
new tables), but BEFORE using the app with real data.

Usage:
    python scripts/migrate_old_data.py
    python scripts/migrate_old_data.py --dry-run   # preview only
    python scripts/migrate_old_data.py --drop-old  # drop old tables after migration
"""

import argparse
import json
import sys

sys.path.insert(0, ".")

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.core.settings import settings
from app.db.base import Base
from app.models import *  # noqa: F401,F403 — loads all models into Base.metadata
from app.models.reference import (
    BudgetStatus,
    FinishType,
    PaymentMethod,
    PriorityLevel,
    WorkOrderStatus,
)
from scripts.seed_reference_data import (
    BUDGET_STATUSES,
    FINISH_TYPES,
    PAYMENT_METHODS,
    PRIORITY_LEVELS,
    WORK_ORDER_STATUSES,
    upsert,
)

# ── Helpers ──────────────────────────────────────────────────────────────────

SEP = "─" * 60


def log(msg: str) -> None:
    print(f"  • {msg}")


def warn(msg: str) -> None:
    print(f"  ⚠ {msg}")


def ok(msg: str) -> None:
    print(f"  ✓ {msg}")


def old_tables_exist(db: Session) -> list[str]:
    """Return list of old Spanish table names that exist in the DB."""
    if settings.is_development:
        q = "SELECT name FROM sqlite_master WHERE type='table'"
    else:
        q = "SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = :db"
    existing = set()
    if settings.is_development:
        rows = db.execute(text(q)).fetchall()
        existing = {r[0] for r in rows}
    else:
        rows = db.execute(text(q), {"db": settings.DB_NAME}).fetchall()
        existing = {r[0] for r in rows}

    old_tables = [
        "clientes",
        "presupuestos",
        "presupuesto_items",
        "presupuesto_adicionales",
        "ordenes_trabajo",
        "mediciones",
        "materiales",
        "stock_piletas",
        "movimientos_piletas",
        "caja_diaria",
        "movimientos_caja",
        "presupuestos_online",
        "configuracion",
        "price_history",
        "users",
        "trabajos_realizados",
    ]
    return [t for t in old_tables if t in existing]


def col_names(db: Session, table: str) -> set[str]:
    """Return set of column names for a table."""
    if settings.is_development:
        q = f"SELECT name FROM pragma_table_info('{table}')"
    else:
        q = (
            "SELECT COLUMN_NAME FROM information_schema.columns "
            f"WHERE TABLE_SCHEMA = :db AND TABLE_NAME = :tbl"
        )
    if settings.is_development:
        rows = db.execute(text(q)).fetchall()
    else:
        rows = db.execute(text(q), {"db": settings.DB_NAME, "tbl": table}).fetchall()
    return {r[0] for r in rows}


def ordered_columns(db: Session, table: str) -> list[str]:
    """Return ordered column names for a table (DB-agnostic)."""
    if settings.is_development:
        rows = db.execute(text(f"PRAGMA table_info({table})")).fetchall()
        return [r[1] for r in rows]  # name is column index 1
    rows = db.execute(text(f"SHOW COLUMNS FROM {table}")).fetchall()
    return [r[0] for r in rows]  # Field is column index 0


# ── Reference data lookup builders ───────────────────────────────────────────


def build_enum_map(db: Session) -> dict[str, dict[str, int]]:
    """Build {table_name: {english_name: id}} lookups for reference tables."""
    maps: dict[str, dict[str, int]] = {}
    for model, rows, key in [
        (BudgetStatus, BUDGET_STATUSES, "budget_statuses"),
        (WorkOrderStatus, WORK_ORDER_STATUSES, "work_order_statuses"),
        (PaymentMethod, PAYMENT_METHODS, "payment_methods"),
        (PriorityLevel, PRIORITY_LEVELS, "priority_levels"),
        (FinishType, FINISH_TYPES, "finish_types"),
    ]:
        maps[key] = {}
        for name, *_ in rows:
            row = db.query(model).filter(model.name == name).first()
            if row:
                maps[key][name] = row.id
    return maps


# ── Spanish → English enum value maps ────────────────────────────────────────

BUDGET_STATUS_MAP: dict[str, str] = {
    "PENDIENTE": "PENDING",
    "ONLINE": "ONLINE",
    "APROBADO": "APPROVED",
    "RECHAZADO": "REJECTED",
    "CONVERTIDO A OT": "CONVERTED_TO_OT",
    "CONVERTIDO": "CONVERTED_TO_OT",
}

WORK_ORDER_STATUS_MAP: dict[str, str] = {
    "MEDICION": "MEASUREMENT",
    "EN MEDICIÓN": "MEASUREMENT",
    "EN MEDICION": "MEASUREMENT",
    "TALLER": "WORKSHOP",
    "EN EL TALLER": "WORKSHOP",
    "TERMINADA": "FINISHED",
    "ENTREGADA": "DELIVERED",
    "CANCELADO": "CANCELLED",
    "CANCELADA": "CANCELLED",
}

PAYMENT_METHOD_MAP: dict[str, str] = {
    "EFECTIVO": "CASH",
    "TRANSFERENCIA": "TRANSFER",
    "TRANSFERENCIA BANCARIA": "TRANSFER",
    "TARJETA DE CRÉDITO": "CREDIT_CARD",
    "TARJETA DE CREDITO": "CREDIT_CARD",
    "TARJETA": "CREDIT_CARD",
    "TARJETA DE DÉBITO": "DEBIT_CARD",
    "TARJETA DE DEBITO": "DEBIT_CARD",
    "CHEQUE": "CHECK",
    "MIXTO": "MIXED",
}

PRIORITY_MAP: dict[str, str] = {
    "BAJA": "LOW",
    "Baja": "LOW",
    "NORMAL": "NORMAL",
    "Normal": "NORMAL",
    "ALTA": "HIGH",
    "Alta": "HIGH",
    "URGENTE": "URGENT",
    "URGENT": "URGENT",
    "Urgente": "URGENT",
}

MEASUREMENT_STATUS_MAP: dict[str, str] = {
    "PENDIENTE": "PENDING",
    "REALIZADA": "DONE",
    "CANCELADA": "CANCELLED",
}

FINISH_MAP: dict[str, str] = {
    "PULIDO": "POLISHED",
    "Pulido": "POLISHED",
    "APOMAZADO": "HONED",
    "Apomazado": "HONED",
    "ABUJARDADO": "BUSHED",
    "Abujardado": "BUSHED",
    "LLAMEADO": "FLAMED",
    "Llameado": "FLAMED",
    "ARENADO": "SAND",
    "Arenado": "SAND",
    "CUERO": "LEATHERED",
    "Cuero": "LEATHERED",
}

MOVEMENT_TYPE_MAP: dict[str, str] = {
    "INGRESO": "INCOME",
    "EGRESO": "EXPENSE",
}

STOCK_MOVEMENT_TYPE_MAP: dict[str, str] = {
    "ENTRADA": "IN",
    "SALIDA": "OUT",
}


def s(v: Any) -> Any:
    """Coerce a value to a suitable type, handling None."""
    return None if v is None else v


def f(v: Any) -> float:
    """Coerce to float, default 0."""
    if v is None:
        return 0.0
    return float(v)


def i(v: Any) -> int:
    """Coerce to int, default 0."""
    if v is None:
        return 0
    return int(v)


def dt(v: Any) -> Any:
    """Return datetime or None."""
    if v is None or v == "":
        return None
    if isinstance(v, datetime):
        return v
    if isinstance(v, date):
        return datetime.combine(v, datetime.min.time())
    return v


def as_json(v: Any) -> str | None:
    """Serialize a value as JSON string, or return None."""
    if v is None:
        return None
    if isinstance(v, str):
        try:
            json.loads(v)
            return v
        except (json.JSONDecodeError, TypeError):
            pass
    try:
        return json.dumps(v, ensure_ascii=False, default=str)
    except (TypeError, ValueError):
        return str(v)


# ── Migration functions ──────────────────────────────────────────────────────


def migrate_clients(db: Session, affected: list[str]) -> int:
    """migrate clientes → clients"""
    rows = db.execute(text("SELECT * FROM clientes")).fetchall()
    cols = ordered_columns(db, "clientes")
    count = 0
    for row in rows:
        data = dict(zip(cols, row))
        existing = db.execute(
            text("SELECT id FROM clients WHERE id = :id"), {"id": data["id"]}
        ).fetchone()
        if existing:
            continue
        db.execute(
            text("""
                INSERT INTO clients (id, name, phone, email, address, notes,
                    total_purchased, created_at, updated_at)
                VALUES (:id, :name, :phone, :email, :address, :notes, 0,
                    :created_at, :updated_at)
            """),
            {
                "id": data["id"],
                "name": s(data.get("nombre", "")),
                "phone": s(data.get("telefono")),
                "email": s(data.get("email")),
                "address": s(data.get("direccion")),
                "notes": s(data.get("observaciones")),
                "created_at": dt(data.get("created_at", datetime.now())),
                "updated_at": dt(data.get("updated_at", datetime.now())),
            },
        )
        count += 1
    db.commit()
    return count


def migrate_budgets(db: Session, enum_map: dict, affected: list[str]) -> int:
    """migrate presupuestos → budgets (also migrates items + adicionales)"""
    rows = db.execute(text("SELECT * FROM presupuestos")).fetchall()
    cols = ordered_columns(db, "presupuestos")
    statuses = enum_map["budget_statuses"]
    methods = enum_map["payment_methods"]
    priorities = enum_map["priority_levels"]
    finishes = enum_map["finish_types"]

    count = 0
    for row in rows:
        data = dict(zip(cols, row))
        existing = db.execute(
            text("SELECT id FROM budgets WHERE id = :id"), {"id": data["id"]}
        ).fetchone()
        if existing:
            continue

        raw_status = (data.get("estado") or "").strip().upper()
        eng_status = BUDGET_STATUS_MAP.get(data.get("estado", ""), "PENDING")
        eng_method = PAYMENT_METHOD_MAP.get(data.get("forma_pago", ""), "")
        eng_priority = PRIORITY_MAP.get(data.get("prioridad", ""), "NORMAL")
        eng_finish = FINISH_MAP.get(data.get("terminacion", ""), "")
        currency = data.get("moneda", "ARS") or "ARS"

        db.execute(
            text("""
                INSERT INTO budgets (
                    id, number, client_id, status, status_id,
                    material, material_price_m2, material_price_m2_usd,
                    materials_data, color, thickness, front, finish, finish_id,
                    bacha, anafe, perforations,
                    currency, usd_rate, subtotal_materials, subtotal_services,
                    subtotal, transport, installation, discount,
                    discount_percentage, discount_fixed_amount,
                    total, subtotal_usd, transport_usd, total_usd,
                    deposit_received, deposit_currency, deposit_usd,
                    balance_due, balance_due_usd, balance_paid, balance_paid_at,
                    payment_method, payment_method_id, installments,
                    validity_days, estimated_delivery, estimated_date,
                    priority, priority_id, date,
                    delivery_date, digital_signature, signed_at, approval_date,
                    design_observations, important_observations, notes,
                    fabrication_details, pool_id, pool_price, pool_currency,
                    pool_image, stock_deducted, pools_data,
                    snapshot_name, snapshot_phone, snapshot_email, snapshot_address,
                    created_at, updated_at
                ) VALUES (
                    :id, :number, :client_id, :status, :status_id,
                    :material, :mat_pm2, :mat_pm2_usd,
                    :materials_data, :color, :thickness, :front, :finish, :finish_id,
                    :bacha, :anafe, :perforations,
                    :currency, :usd_rate, :sub_mats, :sub_svcs,
                    :subtotal, :transport, :installation, :discount,
                    :discount_pct, :discount_fixed,
                    :total, :sub_usd, :transp_usd, :total_usd,
                    :deposit, :dep_currency, :deposit_usd,
                    :balance_due, :balance_due_usd, :balance_paid, :balance_paid_at,
                    :payment_method, :payment_method_id, :installments,
                    :validity, :estimated_delivery, :estimated_date,
                    :priority, :priority_id, :date,
                    :delivery_date, :signature, :signed_at, :approval_date,
                    :design_obs, :important_obs, :notes,
                    :fab_details, :pool_id, :pool_price, :pool_currency,
                    :pool_image, :stock_deducted, :pools_data,
                    :snap_name, :snap_phone, :snap_email, :snap_address,
                    :created_at, :updated_at
                )
            """),
            {
                "id": data["id"],
                "number": s(data.get("numero", "")),
                "client_id": s(data.get("cliente_id")),
                "status": eng_status,
                "status_id": statuses.get(eng_status),
                "material": s(data.get("material")),
                "mat_pm2": f(data.get("material_precio_m2")),
                "mat_pm2_usd": f(data.get("material_precio_m2_usd")),
                "materials_data": as_json(data.get("materiales")),
                "color": s(data.get("color_tipo")),
                "thickness": s(data.get("espesor")),
                "front": s(data.get("frente")),
                "finish": s(data.get("terminacion")),
                "finish_id": finishes.get(eng_finish),
                "bacha": s(data.get("bacha")),
                "anafe": s(data.get("anafe")),
                "perforations": None,
                "currency": currency,
                "usd_rate": f(data.get("tipo_cambio", 1)),
                "sub_mats": f(data.get("subtotal_materiales")),
                "sub_svcs": f(data.get("subtotal_servicios")),
                "subtotal": f(data.get("subtotal")),
                "transport": f(data.get("traslado")),
                "installation": f(data.get("instalacion", 0)),
                "discount": f(data.get("descuento", 0)),
                "discount_pct": f(data.get("descuento_porcentaje")),
                "discount_fixed": f(data.get("descuento_monto_fijo")),
                "total": f(data.get("total")),
                "sub_usd": f(data.get("subtotal_usd")),
                "transp_usd": f(data.get("traslado_usd")),
                "total_usd": f(data.get("total_usd")),
                "deposit": f(data.get("sena_recibida")),
                "dep_currency": s(data.get("sena_moneda", "ARS")),
                "deposit_usd": f(data.get("sena_usd")),
                "balance_due": f(data.get("saldo_pendiente")),
                "balance_due_usd": f(data.get("saldo_pendiente_usd")),
                "balance_paid": bool(data.get("saldo_pagado", False)),
                "balance_paid_at": dt(data.get("fecha_pago_saldo")),
                "payment_method": s(data.get("forma_pago")),
                "payment_method_id": methods.get(eng_method),
                "installments": i(data.get("cuotas", 1)),
                "validity": i(data.get("validez", "10").split()[0]),
                "estimated_delivery": s(data.get("entrega_aproximada")),
                "estimated_date": dt(data.get("fecha_estimada_entrega")),
                "priority": eng_priority,
                "priority_id": priorities.get(eng_priority),
                "date": dt(data.get("fecha")),
                "delivery_date": dt(data.get("fecha_entrega")),
                "signature": s(data.get("firma_cliente")),
                "signed_at": dt(data.get("fecha_aprobacion")),
                "approval_date": dt(data.get("fecha_aprobacion")),
                "design_obs": s(data.get("observaciones_diseno")),
                "important_obs": s(data.get("observaciones_importantes")),
                "notes": s(data.get("observaciones")),
                "fab_details": as_json(data.get("detalles_fabricacion")),
                "pool_id": s(data.get("pileta_id")),
                "pool_price": f(data.get("pileta_precio")),
                "pool_currency": s(data.get("pileta_moneda", "ARS")),
                "pool_image": s(data.get("pileta_imagen")),
                "stock_deducted": bool(data.get("stock_descontado", False)),
                "pools_data": as_json(data.get("piletas")),
                "snap_name": None,
                "snap_phone": None,
                "snap_email": None,
                "snap_address": None,
                "created_at": dt(data.get("created_at", datetime.now())),
                "updated_at": dt(data.get("updated_at", datetime.now())),
            },
        )
        count += 1

    # Migrate items
    if "presupuesto_items" in affected:
        item_rows = db.execute(text("SELECT * FROM presupuesto_items")).fetchall()
        item_cols = ordered_columns(db, "presupuesto_items")
        for row in item_rows:
            data = dict(zip(item_cols, row))
            existing = db.execute(
                text("SELECT id FROM budget_items WHERE id = :id"), {"id": data["id"]}
            ).fetchone()
            if existing:
                continue
            db.execute(
                text("""
                    INSERT INTO budget_items (id, budget_id, sector, description,
                        unit_length, unit_width, length, width, m2, quantity,
                        price_m2, unit_price, total)
                    VALUES (:id, :budget_id, :sector, :description,
                        :unit_length, :unit_width, :length, :width, :m2, :quantity,
                        :price_m2, :unit_price, :total)
                """),
                {
                    "id": data["id"],
                    "budget_id": data["presupuesto_id"],
                    "sector": s(data.get("sector")),
                    "description": "",
                    "unit_length": s(data.get("unidad_largo", "cm")),
                    "unit_width": s(data.get("unidad_ancho", "cm")),
                    "length": f(data.get("largo")),
                    "width": f(data.get("ancho")),
                    "m2": f(data.get("m2")),
                    "quantity": f(data.get("cantidad", 1)),
                    "price_m2": f(data.get("precio_m2")),
                    "unit_price": f(data.get("precio_m2")),
                    "total": f(data.get("subtotal")),
                },
            )

    # Migrate adicionales
    if "presupuesto_adicionales" in affected:
        adic_rows = db.execute(text("SELECT * FROM presupuesto_adicionales")).fetchall()
        adic_cols = ordered_columns(db, "presupuesto_adicionales")
        for row in adic_rows:
            data = dict(zip(adic_cols, row))
            existing = db.execute(
                text("SELECT id FROM budget_adicionales WHERE id = :id"), {"id": data["id"]}
            ).fetchone()
            if existing:
                continue
            db.execute(
                text("""
                    INSERT INTO budget_adicionales (id, budget_id, concept, detail,
                        quantity, unit_price, total)
                    VALUES (:id, :budget_id, :concept, :detail,
                        :quantity, :unit_price, :total)
                """),
                {
                    "id": data["id"],
                    "budget_id": data["presupuesto_id"],
                    "concept": s(data.get("concepto")),
                    "detail": s(data.get("detalle")),
                    "quantity": i(data.get("cantidad", 1)),
                    "unit_price": f(data.get("precio_unitario")),
                    "total": f(data.get("subtotal")),
                },
            )

    db.commit()
    return count


def migrate_work_orders(db: Session, enum_map: dict) -> int:
    """migrate ordenes_trabajo → work_orders"""
    rows = db.execute(text("SELECT * FROM ordenes_trabajo")).fetchall()
    cols = ordered_columns(db, "ordenes_trabajo")
    statuses = enum_map["work_order_statuses"]
    methods = enum_map["payment_methods"]
    priorities = enum_map["priority_levels"]
    finishes = enum_map["finish_types"]

    count = 0
    for row in rows:
        data = dict(zip(cols, row))
        existing = db.execute(
            text("SELECT id FROM work_orders WHERE id = :id"), {"id": data["id"]}
        ).fetchone()
        if existing:
            continue

        eng_status = WORK_ORDER_STATUS_MAP.get(data.get("estado", ""), "MEASUREMENT")
        eng_method = PAYMENT_METHOD_MAP.get(data.get("forma_pago", ""), "")
        eng_priority = PRIORITY_MAP.get(data.get("prioridad", ""), "NORMAL")
        eng_finish = FINISH_MAP.get(data.get("acabado", ""), "")

        db.execute(
            text("""
                INSERT INTO work_orders (
                    id, number, client_id, budget_id, status, status_id,
                    origin, material, material_price_m2, materials_data,
                    color, thickness, finish, finish_id,
                    bacha, anafe, currency, usd_rate,
                    subtotal, transport, installation, discount,
                    discount_percentage, discount_fixed_amount,
                    total, subtotal_usd, transport_usd, total_usd,
                    deposit_received, deposit_currency, deposit_usd,
                    balance_due, balance_due_usd, balance_paid, balance_paid_at,
                    payment_method, payment_method_id, installments,
                    priority, priority_id, delivery_date,
                    digital_signature, signed_at,
                    fabrication_details, budgeted_details,
                    pool_id, pool_price, pool_currency,
                    pool_image, stock_deducted, pools_data,
                    adicionales_data,
                    design_observations, important_observations, notes,
                    snapshot_name, snapshot_phone, snapshot_email, snapshot_address,
                    date, created_at, updated_at
                ) VALUES (
                    :id, :number, :client_id, :budget_id, :status, :status_id,
                    :origin, :material, :mat_pm2, :materials_data,
                    :color, :thickness, :finish, :finish_id,
                    :bacha, :anafe, :currency, :usd_rate,
                    :subtotal, :transport, :installation, :discount,
                    :discount_pct, :discount_fixed,
                    :total, :sub_usd, :transp_usd, :total_usd,
                    :deposit, :dep_currency, :deposit_usd,
                    :balance_due, :balance_due_usd, :balance_paid, :balance_paid_at,
                    :payment_method, :payment_method_id, :installments,
                    :priority, :priority_id, :delivery_date,
                    :signature, :signed_at,
                    :fab_details, :budgeted_details,
                    :pool_id, :pool_price, :pool_currency,
                    :pool_image, :stock_deducted, :pools_data,
                    :adicionales_data,
                    :design_obs, :important_obs, :notes,
                    :snap_name, :snap_phone, :snap_email, :snap_address,
                    :date, :created_at, :updated_at
                )
            """),
            {
                "id": data["id"],
                "number": s(data.get("numero", "")),
                "client_id": s(data.get("cliente_id")),
                "budget_id": s(data.get("presupuesto_id")),
                "status": eng_status,
                "status_id": statuses.get(eng_status),
                "origin": s(data.get("origen", "Manual")),
                "material": s(data.get("material")),
                "mat_pm2": f(data.get("material_precio_m2")),
                "materials_data": as_json(data.get("materiales")),
                "color": s(data.get("color_tipo")),
                "thickness": s(data.get("espesor")),
                "finish": s(data.get("acabado")),
                "finish_id": finishes.get(eng_finish),
                "bacha": s(data.get("bacha")),
                "anafe": s(data.get("anafe")),
                "currency": "ARS",
                "usd_rate": f(data.get("tipo_cambio", 1)),
                "subtotal": f(data.get("subtotal")),
                "transport": f(data.get("traslado")),
                "installation": f(data.get("instalacion", 0)),
                "discount": f(data.get("descuento", 0)),
                "discount_pct": f(data.get("descuento_porcentaje")),
                "discount_fixed": f(data.get("descuento_monto_fijo")),
                "total": f(data.get("total")),
                "sub_usd": f(data.get("subtotal_usd")),
                "transp_usd": f(data.get("traslado_usd")),
                "total_usd": f(data.get("total_usd")),
                "deposit": f(data.get("sena_recibida")),
                "dep_currency": s(data.get("sena_moneda", "ARS")),
                "deposit_usd": f(data.get("sena_usd")),
                "balance_due": f(data.get("saldo_pendiente")),
                "balance_due_usd": f(data.get("saldo_pendiente_usd")),
                "balance_paid": bool(data.get("saldo_pagado", False)),
                "balance_paid_at": dt(data.get("fecha_pago_saldo")),
                "payment_method": s(data.get("forma_pago")),
                "payment_method_id": methods.get(eng_method),
                "installments": i(data.get("cuotas", 1)),
                "priority": eng_priority,
                "priority_id": priorities.get(eng_priority),
                "delivery_date": dt(data.get("fecha_entrega")),
                "signature": s(data.get("firma_cliente")),
                "signed_at": dt(data.get("fecha_aprobacion")),
                "fab_details": as_json(data.get("detalles_fabricacion")),
                "budgeted_details": as_json(data.get("detalles_presupuestados")),
                "pool_id": s(data.get("pileta_id")),
                "pool_price": f(data.get("pileta_precio")),
                "pool_currency": s(data.get("pileta_moneda", "ARS")),
                "pool_image": s(data.get("pileta_imagen")),
                "stock_deducted": bool(data.get("stock_descontado", False)),
                "pools_data": as_json(data.get("piletas")),
                "adicionales_data": as_json(data.get("adicionales")),
                "design_obs": s(data.get("observaciones_diseno")),
                "important_obs": s(data.get("observaciones_importantes")),
                "notes": s(data.get("observaciones")),
                "snap_name": None,
                "snap_phone": None,
                "snap_email": None,
                "snap_address": None,
                "date": dt(data.get("fecha")),
                "created_at": dt(data.get("created_at", datetime.now())),
                "updated_at": dt(data.get("updated_at", datetime.now())),
            },
        )
        count += 1

    db.commit()
    return count


def migrate_measurements(db: Session) -> int:
    """migrate mediciones → measurements"""
    rows = db.execute(text("SELECT * FROM mediciones")).fetchall()
    cols = ordered_columns(db, "mediciones")
    count = 0
    for row in rows:
        data = dict(zip(cols, row))
        existing = db.execute(
            text("SELECT id FROM measurements WHERE id = :id"), {"id": data["id"]}
        ).fetchone()
        if existing:
            continue
        eng_status = MEASUREMENT_STATUS_MAP.get(data.get("estado", ""), "PENDING")
        db.execute(
            text("""
                INSERT INTO measurements (id, client_name, client_phone,
                    client_address, scheduled_date, scheduled_time, notes,
                    sketch_data, photos_data, status, created_at, updated_at)
                VALUES (:id, :client_name, :client_phone,
                    :client_address, :scheduled_date, :scheduled_time, :notes,
                    :sketch_data, :photos_data, :status, :created_at, :updated_at)
            """),
            {
                "id": data["id"],
                "client_name": s(data.get("cliente_nombre")),
                "client_phone": s(data.get("cliente_telefono")),
                "client_address": s(data.get("cliente_direccion")),
                "scheduled_date": dt(data.get("fecha_programada")),
                "scheduled_time": s(data.get("hora_programada")),
                "notes": s(data.get("observaciones")),
                "sketch_data": as_json(data.get("croquis")),
                "photos_data": as_json(data.get("fotos")),
                "status": eng_status,
                "created_at": dt(data.get("created_at", datetime.now())),
                "updated_at": dt(data.get("updated_at", datetime.now())),
            },
        )
        count += 1
    db.commit()
    return count


def migrate_materials(db: Session) -> int:
    """migrate materiales → materials + material_categories + material_colors"""
    rows = db.execute(text("SELECT * FROM materiales")).fetchall()
    cols = ordered_columns(db, "materiales")

    # Ensure 'General' category exists
    existing_cat = db.execute(
        text("SELECT id FROM material_categories WHERE name = 'General'")
    ).fetchone()
    if not existing_cat:
        db.execute(text("INSERT INTO material_categories (id, name) VALUES (1, 'General')"))
        db.commit()
        cat_id = 1
    else:
        cat_id = existing_cat[0]

    count = 0
    for row in rows:
        data = dict(zip(cols, row))
        existing = db.execute(
            text("SELECT id FROM materials WHERE id = :id"), {"id": data["id"]}
        ).fetchone()
        if existing:
            continue
        db.execute(
            text("""
                INSERT INTO materials (id, name, category_id, color,
                    available_thickness, base_price, price_usd, currency,
                    supplier, stock_available, notes, created_at)
                VALUES (:id, :name, :cat_id, :color,
                    :thickness, :base_price, :price_usd, :currency,
                    :supplier, :stock, :notes, :created_at)
            """),
            {
                "id": data["id"],
                "name": s(data.get("nombre", "")),
                "cat_id": cat_id,
                "color": s(data.get("color")),
                "thickness": s(data.get("espesor_disponible")),
                "base_price": f(data.get("precio_m2")),
                "price_usd": f(data.get("precio_m2_usd")),
                "currency": s(data.get("moneda", "ARS")),
                "supplier": s(data.get("proveedor")),
                "stock": i(data.get("stock_disponible", 0)),
                "notes": s(data.get("observaciones")),
                "created_at": dt(data.get("created_at", datetime.now())),
            },
        )
        count += 1
    db.commit()
    return count


def migrate_pool_stock(db: Session) -> int:
    """migrate stock_piletas → pool_stock"""
    rows = db.execute(text("SELECT * FROM stock_piletas")).fetchall()
    cols = ordered_columns(db, "stock_piletas")
    count = 0
    for row in rows:
        data = dict(zip(cols, row))
        existing = db.execute(
            text("SELECT id FROM pool_stock WHERE id = :id"), {"id": data["id"]}
        ).fetchone()
        if existing:
            continue
        db.execute(
            text("""
                INSERT INTO pool_stock (id, brand, model, description,
                    material, quantity, price, price_usd, created_at, updated_at)
                VALUES (:id, :brand, :model, :description,
                    :material, :quantity, :price, :price_usd, :created_at, :updated_at)
            """),
            {
                "id": data["id"],
                "brand": s(data.get("marca", "")),
                "model": s(data.get("modelo", "")),
                "description": s(data.get("descripcion")),
                "material": s(data.get("material")),
                "quantity": i(data.get("cantidad", 0)),
                "price": f(data.get("precio")),
                "price_usd": f(data.get("precio_usd")),
                "created_at": dt(data.get("created_at", datetime.now())),
                "updated_at": dt(data.get("updated_at", datetime.now())),
            },
        )
        count += 1
    db.commit()
    return count


def migrate_stock_movements(db: Session) -> int:
    """migrate movimientos_piletas → stock_movements"""
    rows = db.execute(text("SELECT * FROM movimientos_piletas")).fetchall()
    cols = ordered_columns(db, "movimientos_piletas")
    count = 0
    for row in rows:
        data = dict(zip(cols, row))
        existing = db.execute(
            text("SELECT id FROM stock_movements WHERE id = :id"), {"id": data["id"]}
        ).fetchone()
        if existing:
            continue
        eng_type = STOCK_MOVEMENT_TYPE_MAP.get(data.get("tipo", ""), "OUT")
        db.execute(
            text("""
                INSERT INTO stock_movements (id, pool_id, type, quantity, notes, created_at)
                VALUES (:id, :pool_id, :type, :quantity, :notes, :created_at)
            """),
            {
                "id": data["id"],
                "pool_id": data["pileta_id"],
                "type": eng_type,
                "quantity": i(data.get("cantidad")),
                "notes": s(data.get("descripcion")),
                "created_at": dt(data.get("created_at", datetime.now())),
            },
        )
        count += 1
    db.commit()
    return count


def migrate_daily_cash(db: Session) -> int:
    """migrate caja_diaria → daily_cash (also migrates movements)"""
    rows = db.execute(text("SELECT * FROM caja_diaria")).fetchall()
    cols = ordered_columns(db, "caja_diaria")
    count = 0
    for row in rows:
        data = dict(zip(cols, row))
        existing = db.execute(
            text("SELECT id FROM daily_cash WHERE id = :id"), {"id": data["id"]}
        ).fetchone()
        if existing:
            continue
        db.execute(
            text("""
                INSERT INTO daily_cash (id, date, previous_balance,
                    total_income, total_expenses, total_sum, current_balance,
                    real_cash, is_closed, notes, created_at, updated_at)
                VALUES (:id, :date, :previous_balance,
                    :total_income, :total_expenses, :total_sum, :current_balance,
                    :real_cash, :is_closed, :notes, :created_at, :updated_at)
            """),
            {
                "id": data["id"],
                "date": data["fecha"],
                "previous_balance": f(data.get("saldo_anterior")),
                "total_income": f(data.get("total_ingresos")),
                "total_expenses": f(data.get("total_salidas")),
                "total_sum": f(data.get("suma")),
                "current_balance": f(data.get("saldo_actual")),
                "real_cash": f(data.get("efectivo_real")),
                "is_closed": bool(data.get("cerrada", False)),
                "notes": s(data.get("observaciones")),
                "created_at": dt(data.get("created_at", datetime.now())),
                "updated_at": dt(data.get("updated_at", datetime.now())),
            },
        )
        count += 1

    # Migrate cash movements
    if col_names(db, "movimientos_caja"):
        mov_rows = db.execute(text("SELECT * FROM movimientos_caja")).fetchall()
        mov_cols = ordered_columns(db, "movimientos_caja")
        for row in mov_rows:
            data = dict(zip(mov_cols, row))
            existing = db.execute(
                text("SELECT id FROM cash_movements WHERE id = :id"), {"id": data["id"]}
            ).fetchone()
            if existing:
                continue
            eng_type = MOVEMENT_TYPE_MAP.get(data.get("tipo", ""), "INCOME")
            db.execute(
                text("""
                    INSERT INTO cash_movements (id, daily_cash_id, type, amount,
                        description, created_at,
                        order_id, order_number, order_total, client_name,
                        payment_method, folder_status, remaining_balance, expense_type)
                    VALUES (:id, :caja_id, :type, :amount,
                        :desc, :created_at,
                        :order_id, :order_number, :order_total, :client_name,
                        :payment_method, :folder_status, :remaining, :expense_type)
                """),
                {
                    "id": data["id"],
                    "caja_id": data["caja_id"],
                    "type": eng_type,
                    "amount": f(data.get("monto")),
                    "desc": s(data.get("concepto", "")),
                    "created_at": dt(data.get("created_at", datetime.now())),
                    "order_id": s(data.get("orden_id")),
                    "order_number": s(data.get("orden_numero")),
                    "order_total": f(data.get("orden_total")),
                    "client_name": s(data.get("cliente_nombre")),
                    "payment_method": s(data.get("forma_pago")),
                    "folder_status": s(data.get("estado_carpeta")),
                    "remaining": f(data.get("saldo_restante")),
                    "expense_type": s(data.get("tipo_egreso")),
                },
            )

    db.commit()
    return count


def migrate_online_budgets(db: Session) -> int:
    """migrate presupuestos_online → online_budgets"""
    rows = db.execute(text("SELECT * FROM presupuestos_online")).fetchall()
    cols = ordered_columns(db, "presupuestos_online")
    count = 0
    for row in rows:
        data = dict(zip(cols, row))
        existing = db.execute(
            text("SELECT id FROM online_budgets WHERE id = :id"), {"id": data["id"]}
        ).fetchone()
        if existing:
            continue
        eng_status = BUDGET_STATUS_MAP.get(data.get("estado", ""), "ONLINE")
        db.execute(
            text("""
                INSERT INTO online_budgets (id, number, client_name, phone,
                    work_type, date, status, usd_rate, items_data,
                    total_net_ars, total_net_usd, total_consolidated,
                    pool_id, pool_price, created_at, updated_at)
                VALUES (:id, :number, :client_name, :phone,
                    :work_type, :date, :status, :usd_rate, :items_data,
                    :total_net_ars, :total_net_usd, :total_consolidated,
                    :pool_id, :pool_price, :created_at, :updated_at)
            """),
            {
                "id": data["id"],
                "number": s(data.get("numero", "")),
                "client_name": s(data.get("cliente")),
                "phone": s(data.get("telefono")),
                "work_type": s(data.get("tipo_obra")),
                "date": s(data.get("fecha")),
                "status": eng_status,
                "usd_rate": f(data.get("dolar_dia", 1)),
                "items_data": as_json(data.get("items")),
                "total_net_ars": f(data.get("total_neto_ars")),
                "total_net_usd": f(data.get("total_neto_usd")),
                "total_consolidated": f(data.get("total_consolidado")),
                "pool_id": s(data.get("pileta_id")),
                "pool_price": f(data.get("pileta_precio")),
                "created_at": dt(data.get("created_at", datetime.now())),
                "updated_at": dt(data.get("updated_at", datetime.now())),
            },
        )
        count += 1
    db.commit()
    return count


def migrate_settings(db: Session) -> int:
    """migrate configuracion → settings"""
    rows = db.execute(text("SELECT * FROM configuracion")).fetchall()
    cols = ordered_columns(db, "configuracion")
    count = 0
    for row in rows:
        data = dict(zip(cols, row))
        existing = db.execute(
            text("SELECT key FROM settings WHERE key = :key"), {"key": data["key"]}
        ).fetchone()
        if existing:
            continue
        db.execute(
            text("INSERT INTO settings (key, value) VALUES (:key, :value)"),
            {"key": data["key"], "value": s(data.get("value", ""))},
        )
        count += 1
    db.commit()
    return count


def migrate_price_history(db: Session) -> int:
    """migrate price_history (same name, column renames)"""
    rows = db.execute(text("SELECT * FROM price_history")).fetchall()
    cols = ordered_columns(db, "price_history")
    count = 0
    for row in rows:
        data = dict(zip(cols, row))
        existing = db.execute(
            text("SELECT id FROM price_history WHERE id = :id"), {"id": data["id"]}
        ).fetchone()
        if existing:
            continue
        db.execute(
            text("""
                INSERT INTO price_history (id, material_id, material_name,
                    price_m2, date, created_at)
                VALUES (:id, :material_id, :material_name,
                    :price_m2, :date, :created_at)
            """),
            {
                "id": data["id"],
                "material_id": data["material_id"],
                "material_name": s(data.get("material_nombre")),
                "price_m2": f(data.get("precio_m2")),
                "date": dt(data.get("fecha", datetime.now())),
                "created_at": dt(data.get("created_at", datetime.now())),
            },
        )
        count += 1
    db.commit()
    return count


def migrate_users(db: Session) -> int:
    """migrate users (same name + structure)"""
    rows = db.execute(text("SELECT * FROM users")).fetchall()
    cols = ordered_columns(db, "users")
    count = 0
    for row in rows:
        data = dict(zip(cols, row))
        existing = db.execute(
            text("SELECT id FROM users WHERE id = :id"), {"id": data["id"]}
        ).fetchone()
        if existing:
            continue
        db.execute(
            text("""
                INSERT INTO users (id, username, email, hashed_password, full_name,
                    is_active, is_admin, created_at, updated_at)
                VALUES (:id, :username, :email, :hashed_password, :full_name,
                    :is_active, :is_admin, :created_at, :updated_at)
            """),
            {
                "id": data["id"],
                "username": data["username"],
                "email": data["email"],
                "hashed_password": data["hashed_password"],
                "full_name": s(data.get("full_name")),
                "is_active": bool(data.get("is_active", True)),
                "is_admin": bool(data.get("is_admin", False)),
                "created_at": dt(data.get("created_at", datetime.now())),
                "updated_at": dt(data.get("updated_at", datetime.now())),
            },
        )
        count += 1
    db.commit()
    return count


# ── Main ─────────────────────────────────────────────────────────────────────


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate old Spanish schema → new English schema")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done without doing it")
    parser.add_argument("--drop-old", action="store_true", help="Drop old tables after successful migration")
    parser.add_argument("--env", default="production", choices=["development", "production"],
                        help="Environment to use (reads DB config from .env)")
    args = parser.parse_args()

    # Override env
    if args.env:
        settings.ENVIRONMENT = args.env

    print(SEP)
    print(f"  AFAMAR — Data Migration ({settings.ENVIRONMENT})")
    print(f"  DB: {settings.DATABASE_URL_SAFE}")
    print(SEP)

    engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
    db = Session(engine)

    try:
        # Check old tables
        old = old_tables_exist(db)
        if not old:
            print("\n  No old Spanish tables found. Nothing to migrate.")
            return 0

        print(f"\n  Found old tables: {', '.join(old)}\n")

        if args.dry_run:
            ok("Dry-run mode — no changes made")
            return 0

        # Step 1: Create new tables if they don't exist
        log("Creating new tables (if missing)...")
        Base.metadata.create_all(engine)
        ok("New tables ready")

        # Step 2: Seed reference data
        log("Seeding reference data...")
        ins, upd = 0, 0
        for name2, (model2, rows2) in {
                "budget_statuses": (BudgetStatus, BUDGET_STATUSES),
                "work_order_statuses": (WorkOrderStatus, WORK_ORDER_STATUSES),
                "payment_methods": (PaymentMethod, PAYMENT_METHODS),
                "priority_levels": (PriorityLevel, PRIORITY_LEVELS),
                "finish_types": (FinishType, FINISH_TYPES),
            }.items():
                i, u = upsert(db, model2, rows2, force=False)
                ins += i
                upd += u
                if i or u:
                    log(f"  {name2}: {i} inserted, {u} updated")
        ok("Reference data seeded")

        # Build enum maps
        enum_map = build_enum_map(db)

        # Step 3: Migrate each table
        migrations = []

        if "clientes" in old:
            log("Migrating clientes → clients...")
            c = migrate_clients(db, old)
            migrations.append(("clientes → clients", c))

        if "presupuestos" in old:
            log("Migrating presupuestos → budgets (with items + adicionales)...")
            c = migrate_budgets(db, enum_map, old)
            migrations.append(("presupuestos → budgets", c))

        if "ordenes_trabajo" in old:
            log("Migrating ordenes_trabajo → work_orders...")
            c = migrate_work_orders(db, enum_map)
            migrations.append(("ordenes_trabajo → work_orders", c))

        if "mediciones" in old:
            log("Migrating mediciones → measurements...")
            c = migrate_measurements(db)
            migrations.append(("mediciones → measurements", c))

        if "materiales" in old:
            log("Migrating materiales → materials...")
            c = migrate_materials(db)
            migrations.append(("materiales → materials", c))

        if "stock_piletas" in old:
            log("Migrating stock_piletas → pool_stock...")
            c = migrate_pool_stock(db)
            migrations.append(("stock_piletas → pool_stock", c))

        if "movimientos_piletas" in old:
            log("Migrating movimientos_piletas → stock_movements...")
            c = migrate_stock_movements(db)
            migrations.append(("movimientos_piletas → stock_movements", c))

        if "caja_diaria" in old:
            log("Migrating caja_diaria → daily_cash (with movements)...")
            c = migrate_daily_cash(db)
            migrations.append(("caja_diaria → daily_cash", c))

        if "presupuestos_online" in old:
            log("Migrating presupuestos_online → online_budgets...")
            c = migrate_online_budgets(db)
            migrations.append(("presupuestos_online → online_budgets", c))

        if "configuracion" in old:
            log("Migrating configuracion → settings...")
            c = migrate_settings(db)
            migrations.append(("configuracion → settings", c))

        if "price_history" in old:
            log("Migrating price_history → price_history...")
            c = migrate_price_history(db)
            migrations.append(("price_history → price_history", c))

        if "users" in old:
            log("Migrating users → users...")
            c = migrate_users(db)
            migrations.append(("users → users", c))

        # Summary
        print(f"\n{SEP}")
        print("  Migration summary:")
        print(f"{SEP}")
        for label, count in migrations:
            status = f"{count} rows" if count else "up to date"
            print(f"    {label:<45} {status}")
        print(SEP)

        # Step 4: Stamp alembic
        log("Stamping alembic version...")
        existing = db.execute(
            text("SELECT version_num FROM alembic_version")
        ).fetchone()
        if existing:
            ok(f"Alembic already stamped at {existing[0]}")
        else:
            db.execute(
                text("INSERT INTO alembic_version (version_num) VALUES ('536b175b6af0')")
            )
            db.commit()
            ok("Stamped at 536b175b6af0")

        # Step 5: Drop old tables (optional)
        if args.drop_old:
            log("Dropping old Spanish tables...")
            tables_to_drop = [
                "trabajos_realizados",
                "movimientos_caja",
                "caja_diaria",
                "movimientos_piletas",
                "stock_piletas",
                "movimientos_piletas",
                "presupuesto_adicionales",
                "presupuesto_items",
                "presupuestos_online",
                "presupuestos",
                "ordenes_trabajo",
                "mediciones",
                "materiales",
                "clientes",
                "configuracion",
                "price_history",
            ]
            for table in tables_to_drop:
                if table in old:
                    db.execute(text(f"DROP TABLE IF EXISTS {table}"))
                    log(f"  Dropped {table}")
            db.commit()
            ok("Old tables dropped")

        print(f"\n  ✅ Migration complete!\n")
        return 0

    except Exception as e:
        db.rollback()
        print(f"\n  ❌ Migration failed: {e}\n")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
