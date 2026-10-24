"""Payment-method catalogue adjustments for the legacy PDF.

The catalogue-driven surcharge / discount and the "METODO DE PAGO"
reference box are resolved here so the data builders stay focused on the
document payload.
"""


def _resolve_catalogue_adjustment(db, data: dict) -> dict:
    """Compute the catalogue-driven surcharge / discount for the PDF
    footer / totals breakdown.

    The form (frontend `useBudgetCalculations` + `buildPdfData` hook)
    and the server-side `_recalculate_totals_from_items` already apply
    this rule when persisting `total` / `total_usd`. The PDF only
    shows a single "TOTAL" line, so the customer can't see the
    surcharge / discount that came from the catalogue. This helper
    surfaces it as discrete breakdown lines (the template uses them
    to render `Recargo (X%)` / `Descuento (X%)` rows + a per-cuota
    table).

    Returns a dict with:
      - catalogue_surcharge_percentage: effective % (0 when N/A)
      - catalogue_surcharge_amount: ARS amount (0 when N/A)
      - catalogue_discount_percentage: effective % (0 when N/A)
      - catalogue_discount_amount: ARS amount (0 when N/A)
      - catalogue_method_label: the row's display label (or "")
      - catalogue_method_name: the row's stable `name` (or "")
      - installments: int (echoed for the footer line)
      - catalogue_installment_detail: list of {cuota, interes, monto}
        for the per-cuota table (only when the method is a credit-card
        percentage surcharge).
    """
    from app.models.reference import PaymentMethod  # local import: avoid cold-start cycle

    pm_id = data.get("payment_method_id")
    pm_name = data.get("payment_method")
    installments = int(data.get("installments") or 1)
    pm = None
    if pm_id:
        pm = db.query(PaymentMethod).filter(PaymentMethod.id == pm_id).first()
    if pm is None and pm_name:
        pm = db.query(PaymentMethod).filter(PaymentMethod.name == pm_name).first()
    if pm is None or pm.type not in ("DISCOUNT", "SURCHARGE") or not pm.value:
        return {
            "catalogue_surcharge_percentage": 0,
            "catalogue_surcharge_amount": 0.0,
            "catalogue_discount_percentage": 0,
            "catalogue_discount_amount": 0.0,
            "catalogue_method_label": "",
            "catalogue_method_name": "",
            "installments": installments,
            "catalogue_installment_detail": [],
        }

    # Credit-card rule (current spec): *recargo lineal por cuota*.
    # El interés `value%` se aplica N veces al total, después se
    # divide en N cuotas iguales. Total = `base × (1 + N × value/100)`.
    value = float(pm.value)
    ratio = 1.0
    if pm.applies_to_installments:
        n = max(1, installments)
        ratio = 1 + n * (value / 100)
    elif pm.is_percentage:
        ratio = 1 - value / 100 if pm.type == "DISCOUNT" else 1 + value / 100

    subtotal = float(data.get("subtotal") or 0)
    transport = float(data.get("transport") or 0)
    discount_pct = float(data.get("discount_percentage") or 0)
    discount_fijo = float(data.get("discount_fixed_amount") or 0)
    base = max(0.0, subtotal + transport)
    if discount_pct > 0:
        base = round(base * (1 - discount_pct / 100))
    elif discount_fijo > 0:
        base = max(0.0, base - discount_fijo)

    # Per-cuota breakdown (only when this is a credit-card percentage
    # surcharge with installments >= 1). Regla actual: las N cuotas
    # son uniformes — todas cargan el mismo `interes` (el `value` del
    # catálogo, p.ej. 9) y el mismo `monto` (total / N). El total
    # ya incluye el recargo (N × value%) porque la `base` pasada
    # arriba es el subtotal+traslado-descuento previo al catálogo.
    installment_detail: list = []
    if pm.type == "SURCHARGE" and pm.is_percentage and installments >= 1:
        n = max(1, installments)
        total_with_surcharge = base * ratio
        per_cuota = round(total_with_surcharge / n, 2) if total_with_surcharge > 0 else 0.0
        for i in range(1, int(n) + 1):
            installment_detail.append(
                {
                    "cuota": i,
                    "interes": value,
                    "monto": per_cuota,
                }
            )

    if pm.type == "SURCHARGE":
        if pm.is_percentage:
            # Round headline % to 2dp so floating point noise
            # (1.09 → 9.000000000000007) doesn't leak into the PDF.
            headline_pct = round((ratio - 1) * 100, 2)
            surcharge_amount = round(base * (ratio - 1))
            return {
                "catalogue_surcharge_percentage": headline_pct,
                "catalogue_surcharge_amount": float(surcharge_amount),
                "catalogue_discount_percentage": 0,
                "catalogue_discount_amount": 0.0,
                "catalogue_method_label": pm.label or pm.name,
                "catalogue_method_name": pm.name,
                "installments": installments,
                "catalogue_installment_detail": installment_detail,
            }
        # Fixed ARS surcharge
        return {
            "catalogue_surcharge_percentage": 0,
            "catalogue_surcharge_amount": value,
            "catalogue_discount_percentage": 0,
            "catalogue_discount_amount": 0.0,
            "catalogue_method_label": pm.label or pm.name,
            "catalogue_method_name": pm.name,
            "installments": installments,
            "catalogue_installment_detail": installment_detail,
        }
    # pm.type == "DISCOUNT"
    if pm.is_percentage:
        discount_amount = round(base * (1 - ratio))
        return {
            "catalogue_surcharge_percentage": 0,
            "catalogue_surcharge_amount": 0.0,
            "catalogue_discount_percentage": round((1 - ratio) * 100, 2),
            "catalogue_discount_amount": float(discount_amount),
            "catalogue_method_label": pm.label or pm.name,
            "catalogue_method_name": pm.name,
            "installments": installments,
            "catalogue_installment_detail": [],
        }
    # Fixed ARS discount
    return {
        "catalogue_surcharge_percentage": 0,
        "catalogue_surcharge_amount": 0.0,
        "catalogue_discount_percentage": 0,
        "catalogue_discount_amount": value,
        "catalogue_method_label": pm.label or pm.name,
        "catalogue_method_name": pm.name,
        "installments": installments,
        "catalogue_installment_detail": [],
    }


def _payment_methods_catalogue(db) -> list:
    """Active payment methods from the `payment_methods` catalogue, ordered
    by `sort_order`, as uppercase `name`s — the same convention the
    frontend preview uses (`buildPdfData.payment_methods_catalogue`) for
    the PDF "METODO DE PAGO" reference box. Percentage surcharges (credit
    card) append their per-installment rate (e.g. "TARJETA DE CRÉDITO - 9%
    P/ CUOTA") so the customer knows the surcharge before paying. Returns []
    when `db` is None (legacy call sites) so the template just skips the
    box."""
    if db is None:
        return []
    from app.models.reference import PaymentMethod  # local import: avoid cold-start cycle
    rows = (
        db.query(PaymentMethod)
        .filter(PaymentMethod.is_active)
        .order_by(PaymentMethod.sort_order.asc())
        .all()
    )
    return [
        f"{row.name} - {int(row.value)}% P/ CUOTA"
        if row.type == "SURCHARGE"
        and row.is_percentage
        and row.applies_to_installments
        and row.value
        else row.name
        for row in rows
    ]
