/**
 * Catalogue payment-method math — pure functions, no React.
 *
 * Extracted from ``useBudgetCalculations.ts`` so the same credit-card
 * surcharge / discount math can be reused by the hook, the PDF builder
 * (``utils/pdf/buildPdfData.ts``) and any future endpoint that needs to
 * answer "what would the total be with this method applied?". Mirrors
 * the backend ``work_order.recalc.apply_payment_method_rules`` branch
 * — the three (hook / PDF builder / server-side recalc) must stay in
 * sync.
 */
import type { PaymentMethod } from '../../types/paymentMethod';
import type { EntityFormState, InstallmentDetailRow } from '../../types/form';
import { round2 } from '../../utils/math';

/**
 * Look up the catalogue row for the currently selected payment method.
 *
 * Prefers the FK (``payment_method_id``) so the operator's selection
 * survives a rename; falls back to the legacy string snapshot
 * (``payment_method``) for budgets / work orders that predate the FK.
 *
 * Returns ``null`` if no row matches — the form then behaves as if no
 * method is selected (no automatic discount / surcharge).
 */
export function resolvePaymentMethod(
  form: EntityFormState,
  catalogue: PaymentMethod[],
): PaymentMethod | null {
  if (form.payment_method_id) {
    const byId = catalogue.find((pm) => pm.id === form.payment_method_id);
    if (byId) return byId;
  }
  if (form.payment_method) {
    const byName = catalogue.find((pm) => pm.name === form.payment_method);
    if (byName) return byName;
  }
  return null;
}

/**
 * Credit-card surcharge formula (current spec) — *recargo lineal por
 * cuota* (no incremental sobre cada cuota individual). El interés
 * ``value%`` se aplica **N veces al total**, después se divide en N
 * cuotas iguales. Algebraicamente:
 *
 *   total = base × (1 + N × value/100)
 *   cuota = total / N  (uniforme para todas las cuotas)
 *
 *   Ejemplo: base = 900000, value = 9, N = 3 →
 *     recargo = 27% (3 × 9%) → total = 900000 × 1.27 = 1_143_000
 *     cada cuota = 1_143_000 / 3 = 381_000
 *
 * Para 1 cuota el recargo colapsa a ``value%`` flat. Para 2 cuotas
 * es ``2 × value%``. La columna "Interés" en la tabla muestra el %
 * por cuota (``value``), no el total.
 *
 * Returns the ratio ``(1 + totalInterestFraction)`` so the caller can
 * multiply either an ARS or USD total by it.
 */
export function linearInstallmentRatio(
  value: number,
  installments: number,
): number {
  const n = Math.max(1, installments);
  const v = Number(value) || 0;
  if (v <= 0) return 1;
  return 1 + n * (v / 100);
}

/**
 * Apply the catalogue method's ``type`` / ``value`` / ``is_percentage`` /
 * ``applies_to_installments`` rules to the current ARS / USD totals.
 *
 * Same logic lives in ``buildPdfData.ts`` (so the PDF and the live form
 * stay in sync) and in ``work_order._recalculate_totals_from_items``
 * (server-side safety net). Touch the three together.
 *
 * Only **SURCHARGE** methods adjust the totals (e.g. credit-card recargo).
 * NONE and DISCOUNT are purely **informational** — the legacy promotional
 * discount by payment method (``apply_cash_discount``) was removed: every
 * discount now goes through ``DiscountSelector`` / ``useCommercialDiscount``
 * (Fase 3). A DISCOUNT method therefore behaves exactly like NONE.
 *
 * Credit-card rule (current spec): recargo lineal por cuota — ``value``
 * se aplica N veces al total, dividido en N cuotas iguales (ver
 * ``linearInstallmentRatio`` arriba). Para métodos sin installments
 * (``applies_to_installments=false``) el recargo es un ``value%`` flat.
 */
export function applyPaymentMethodToTotals(
  pm: PaymentMethod | null,
  installments: number,
  totalArs: number,
  totalUsd: number,
  usdRate: number,
): { totalArs: number; totalUsd: number } {
  if (!pm || pm.type !== 'SURCHARGE' || !pm.value) {
    return { totalArs, totalUsd };
  }
  const value = Number(pm.value) || 0;
  if (value <= 0) return { totalArs, totalUsd };

  // Fixed-amount methods are applied directly (no ratio): a fixed
  // SURCHARGE adds `value` (ARS); the USD mirror converts via `usdRate`.
  // These must NOT share the `ratio === 1` early return below — a fixed
  // amount would never apply because `ratio` stays 1 when neither
  // `is_percentage` nor `applies_to_installments` is set.
  if (!pm.is_percentage && !pm.applies_to_installments) {
    return {
      totalArs: totalArs + value,
      totalUsd: usdRate > 0 ? totalUsd + value / usdRate : totalUsd,
    };
  }

  // Effective ratio applied to the total (1 = no change).
  let ratio = 1;
  if (pm.applies_to_installments) {
    ratio = linearInstallmentRatio(value, installments);
  } else if (pm.is_percentage) {
    ratio = 1 + value / 100;
  }
  if (ratio === 1) return { totalArs, totalUsd };

  if (pm.is_percentage) {
    return {
      totalArs: Math.round(totalArs * ratio),
      totalUsd: round2(totalUsd * ratio),
    };
  }
  return {
    totalArs: totalArs + value,
    totalUsd: usdRate > 0 ? totalUsd + value / usdRate : totalUsd,
  };
}

/**
 * Build the per-cuota breakdown (3-column table the form + PDF render
 * next to the recargo). Only meaningful for credit-card percentage
 * surcharges with ``applies_to_installments=True``; returns ``[]`` for
 * every other shape so callers can render unconditionally.
 *
 * Regla actual: las N cuotas son **uniformes** (todas iguales).
 * ``interes`` muestra el % por cuota (``value``, no ``N × value``) — el
 * total del recargo (``N × value%``) ya está visible en la línea
 * "Recargo (X%)" del PDF. ``monto`` = total / N.
 */
export function computeInstallmentDetail(
  pm: PaymentMethod | null,
  installments: number,
  totalArs: number,
  totalUsd: number,
): { ars: InstallmentDetailRow[]; usd: InstallmentDetailRow[] } {
  const empty = { ars: [] as InstallmentDetailRow[], usd: [] as InstallmentDetailRow[] };
  if (!pm || pm.type !== 'SURCHARGE' || !pm.is_percentage || !pm.applies_to_installments) {
    return empty;
  }
  const value = Number(pm.value) || 0;
  const n = Math.max(1, installments);
  if (value <= 0 || n < 1) return empty;
  const perCuotaArs = totalArs / n;
  const perCuotaUsd = totalUsd / n;
  const ars: InstallmentDetailRow[] = [];
  const usd: InstallmentDetailRow[] = [];
  for (let i = 1; i <= n; i += 1) {
    ars.push({ cuota: i, interes: value, monto: round2(perCuotaArs) });
    usd.push({ cuota: i, interes: value, monto: round2(perCuotaUsd) });
  }
  return { ars, usd };
}
