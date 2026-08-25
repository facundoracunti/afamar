"""Payment methods catalogue seeder.

Bootstraps the 4 methods the Budget/WorkOrder form offers in the
"Forma de pago" `<select>`:

- `EFECTIVO`
- `TRANSFERENCIA BANCARIA`
- `TARJETA DE DÉBITO`
- `TARJETA DE CRÉDITO`

Migrates legacy rows from the pre-catalog Spanish → English → Spanish
saga: the project's first iteration stored methods under English
`name`s (`CASH`, `TRANSFER`, `CREDIT_CARD`, `DEBIT_CARD`, `CHECK`,
`MIXED`), all with `type='NONE' value=0`. We rename the 4 that map to
the current UI options, update their calculation fields to the legacy
behaviour, and drop the 2 unused ones (`CHECK`, `MIXED`). Renames
preserve the row id so `Budget.payment_method_id` / `WorkOrder.
payment_method_id` FKs in legacy data still resolve.

Idempotent: rows are matched by `name` (treated as the stable snapshot
key that `budget.payment_method` / `work_order.payment_method` keep
after this change). Existing rows are left untouched once their `name`
matches the current spec — so any operator-side tweaks to the
calculation fields survive a re-seed.

Calculation defaults match the legacy form behaviour exactly:

- `EFECTIVO`, `TRANSFERENCIA BANCARIA`, `TARJETA DE DÉBITO` → no
  automatic discount / surcharge (`type='NONE'`, `value=0`).
- `TARJETA DE CRÉDITO` → *interés incremental por cuota*: 9% de
  interés sobre la cuota base, incrementando linealmente con la cuota
  N (1=9%, 2=18%, 3=27%, …). `type='SURCHARGE'`, `value=9`,
  `is_percentage=True`, `applies_to_installments=True`. El total
  final escala como `base × (1 + (N+1)/2 × value/100)`. La tabla
  por-cuota se renderiza en el Presupuesto y en el PDF para que el
  cliente vea exactamente cómo queda cada pago.

Operators can edit any of these from `/admin/configuration/payment-methods`
and the form's "Forma de pago" dropdown + the live calculation will
follow the row's `type` / `value` / `is_percentage` /
`applies_to_installments` columns instead of the form-side hardcode.
"""
from __future__ import annotations

from app.models.reference import PaymentMethod
from scripts.seeders.base import SeedResult, get_logger, session_scope


# Current spec (post-migration). (name, label, sort_order, type, value,
# is_percentage, applies_to_installments)
CURRENT_METHODS: tuple[tuple, ...] = (
    (
        "EFECTIVO",
        "Efectivo",
        10,
        "NONE",
        0.0,
        False,
        False,
    ),
    (
        "TRANSFERENCIA BANCARIA",
        "Transferencia bancaria",
        20,
        "NONE",
        0.0,
        False,
        False,
    ),
    (
        "TARJETA DE DÉBITO",
        "Tarjeta de débito",
        30,
        "NONE",
        0.0,
        False,
        False,
    ),
    # Credit-card surcharge rule: *recargo lineal por cuota*. The
    # `value` (9) is the per-cuota percentage. N cuotas apply the
    # surcharge N × value% over the total, then the result is
    # divided uniformly in N cuotas iguales.
    #
    #   Ejemplo: base=900000, N=3, value=9 →
    #     recargo = 3 × 9% = 27%
    #     total   = 900000 × 1.27 = 1_143_000
    #     cada cuota = 1_143_000 / 3 = 381000
    #
    # Operators can tweak `value` from /admin/configuration/payment-methods
    # without re-seeding; the form and the PDF pick up the new value
    # on the next render.
    (
        "TARJETA DE CRÉDITO",
        "Tarjeta de crédito",
        40,
        "SURCHARGE",
        9.0,
        True,
        True,
    ),
)


# Legacy English names that predate the current Spanish catalogue.
# Maps the old `name` → the (new_name, label, sort_order, type, value,
# is_percentage, applies_to_installments) tuple from CURRENT_METHODS
# so we can rename + update in place. Rows that don't appear here
# (CHECK, MIXED) are deleted — they were never exposed in the form
# even when the project was in English.
LEGACY_RENAMES: dict[str, str] = {
    "CASH": "EFECTIVO",
    "TRANSFER": "TRANSFERENCIA BANCARIA",
    "DEBIT_CARD": "TARJETA DE DÉBITO",
    "CREDIT_CARD": "TARJETA DE CRÉDITO",
}

# Legacy names that don't map to anything in the current UI.
LEGACY_DROP: tuple[str, ...] = ("CHECK", "MIXED")


def _spec_for(name: str) -> tuple | None:
    """Return the current-spec tuple for `name`, or None if the name
    1:1 doesn't match. (Used to look up the rename target's full spec
    when migrating a legacy row.)"""
    for spec in CURRENT_METHODS:
        if spec[0] == name:
            return spec
    return None


def seed_payment_methods() -> SeedResult:
    """Migrate legacy English names to the current Spanish catalogue,
    drop the two rows that don't map to any current option, and insert
    any missing current rows.

    Idempotent: re-running after a successful first pass is a no-op
    (everything is already in the current spec).
    """
    logger = get_logger("seeders.payment_methods")
    result = SeedResult(seeder="payment_methods")
    with session_scope() as db:
        existing = {pm.name: pm for pm in db.query(PaymentMethod).all()}

        # 1. Rename legacy rows → preserves id, so legacy FKs in
        #    `budgets.payment_method_id` / `work_orders.payment_method_id`
        #    still point at a valid (now-Spanish) row.
        for old_name, new_name in LEGACY_RENAMES.items():
            row = existing.get(old_name)
            if row is None:
                continue
            spec = _spec_for(new_name)
            if spec is None:
                # Shouldn't happen — LEGACY_RENAMES values are all in
                # CURRENT_METHODS. Defensive skip.
                continue
            row.name = spec[0]
            row.label = spec[1]
            row.sort_order = spec[2]
            row.is_active = True
            row.type = spec[3]
            row.value = spec[4]
            row.is_percentage = spec[5]
            row.applies_to_installments = spec[6]
            logger.info(
                "Renamed legacy payment method %r → %r (with calculation fields)",
                old_name, new_name,
            )
            result.updated += 1
            # Move the local cache forward so the next step sees the
            # new name (and so we don't double-process).
            existing.pop(old_name, None)
            existing[spec[0]] = row

        # 2. Drop legacy rows that don't map to any current option.
        for old_name in LEGACY_DROP:
            row = existing.pop(old_name, None)
            if row is None:
                continue
            db.delete(row)
            logger.info("Dropped legacy payment method %r (no current equivalent)", old_name)
            result.updated += 1

        # 3. Insert any current row that's still missing. If a row with
        #    the same `name` already exists, ensure the calculation
        #    fields match the spec — protects against an earlier
        #    insert that pre-dated the calculation columns (the
        #    `type/value/is_percentage/applies_to_installments`
        #    columns were added in migration b3c4d5e6f7a9 and a row
        #    that was inserted before that migration runs will end up
        #    with `type='NONE' value=0` until a re-seed fixes it).
        for spec in CURRENT_METHODS:
            name = spec[0]
            existing_row = existing.get(name)
            if existing_row is None:
                db.add(
                    PaymentMethod(
                        name=name,
                        label=spec[1],
                        sort_order=spec[2],
                        is_active=True,
                        type=spec[3],
                        value=spec[4],
                        is_percentage=spec[5],
                        applies_to_installments=spec[6],
                    )
                )
                result.inserted += 1
                logger.info("Added payment method: %s", name)
                continue
            # Idempotent sync — only update fields that drifted from
            # the spec, so operator-edited `label` / `sort_order` /
            # calculation tweaks on other rows stay put.
            if (
                existing_row.label != spec[1]
                or existing_row.sort_order != spec[2]
                or existing_row.type != spec[3]
                or float(existing_row.value or 0) != float(spec[4])
                or bool(existing_row.is_percentage) != bool(spec[5])
                or bool(existing_row.applies_to_installments) != bool(spec[6])
            ):
                existing_row.label = spec[1]
                existing_row.sort_order = spec[2]
                existing_row.type = spec[3]
                existing_row.value = spec[4]
                existing_row.is_percentage = spec[5]
                existing_row.applies_to_installments = spec[6]
                logger.info("Synced payment method %r calculation fields to spec", name)
                result.updated += 1
            else:
                result.skipped += 1

    logger.info(
        "Payment methods seed done — %d inserted, %d updated, %d already present",
        result.inserted, result.updated, result.skipped,
    )
    return result
