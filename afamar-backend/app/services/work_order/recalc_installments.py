"""Per-cuota breakdown for the server-side totals recalc.

Extracted verbatim from the former monolithic ``recalc.py``.
"""


def _build_installment_detail(pm, installments: int, total_ars: float, total_usd: float):
    """Return the 3-column installment breakdown for the credit-card SURCHARGE.

    Empty lists when the catalogue method is not a percentage SURCHARGE with
    ``applies_to_installments=True`` (single-cuota / EFECTIVO / TRANSFER all
    short-circuit here so the PDF table renders no rows).
    """
    installment_detail_ars: list = []
    installment_detail_usd: list = []
    if (
        pm is None
        or pm.type != "SURCHARGE"
        or not pm.applies_to_installments
        or not pm.is_percentage
        or float(pm.value) <= 0
        or installments < 1
    ):
        return installment_detail_ars, installment_detail_usd
    value = float(pm.value)  # p.ej. 9
    n = max(1, installments)
    # Las N cuotas son uniformes: total / N (el recargo N × value%
    # ya está incluido en el total). `interes` por cuota muestra
    # el `value` del catálogo, no el acumulado.
    per_cuota_ars = round(total_ars / n, 2) if total_ars > 0 else 0.0
    per_cuota_usd = round(total_usd / n, 2) if total_usd > 0 else 0.0
    for i in range(1, int(n) + 1):
        installment_detail_ars.append(
            {
                "cuota": i,
                "interes": value,
                "monto": per_cuota_ars,
            }
        )
        installment_detail_usd.append(
            {
                "cuota": i,
                "interes": value,
                "monto": per_cuota_usd,
            }
        )
    return installment_detail_ars, installment_detail_usd
