import { useEffect } from 'react';
import type { EntityFormState, FabricationDetail, MaterialInForm, PoolInForm } from '../types';
import type { PaymentMethod } from '../types/paymentMethod';
import { round2 } from '../utils/math';

interface AdditionalWorkRow {
  name?: string;
  detail?: string | null;
  currency?: string;
  price?: number;
  quantity?: number;
  total?: number;
  materialName?: string;
  type?: 'flat' | 'frente';
  linear_meters?: number;
  assigned_material_id?: number | null;
  formula_values?: {
    material_price_m2_at_selection?: number;
    multiplier?: number;
    constant?: number;
    computed_at?: string;
  } | null;
}

/**
 * Look up the catalogue row for the currently selected payment method.
 *
 * Prefers the FK (`payment_method_id`) so the operator's selection
 * survives a rename; falls back to the legacy string snapshot
 * (`payment_method`) for budgets / work orders that predate the FK.
 *
 * Returns `null` if no row matches — the form then behaves as if no
 * method is selected (no automatic discount / surcharge).
 */
function resolvePaymentMethod(
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
 * One row of the per-cuota breakdown surfaced in the form + PDF.
 * Same shape on the backend (`_recalculate_totals_from_items` →
 * `installment_detail_ars` / `installment_detail_usd`).
 */
export interface InstallmentDetailRow {
  cuota: number;
  interes: number;
  monto: number;
}

/**
 * Credit-card surcharge formula (current spec) — *recargo lineal por
 * cuota* (no incremental sobre cada cuota individual). El interés
 * `value%` se aplica **N veces al total**, después se divide en N
 * cuotas iguales. Algebraicamente:
 *
 *   total = base × (1 + N × value/100)
 *   cuota = total / N  (uniforme para todas las cuotas)
 *
 *   Ejemplo: base = 900000, value = 9, N = 3 →
 *     recargo = 27% (3 × 9%) → total = 900000 × 1.27 = 1_143_000
 *     cada cuota = 1_143_000 / 3 = 381_000
 *
 * Para 1 cuota el recargo colapsa a `value%` flat. Para 2 cuotas
 * es `2 × value%`. La columna "Interés" en la tabla muestra el %
 * por cuota (`value`), no el total.
 *
 * Returns the ratio `(1 + totalInterestFraction)` so the caller can
 * multiply either an ARS or USD total by it.
 */
function linearInstallmentRatio(
  value: number,
  installments: number,
): number {
  const n = Math.max(1, installments);
  const v = Number(value) || 0;
  if (v <= 0) return 1;
  return 1 + n * (v / 100);
}

/**
 * Apply the catalogue method's `type` / `value` / `is_percentage` /
 * `applies_to_installments` rules to the current ARS / USD totals.
 *
 * Same logic lives in `buildPdfData.ts` (so the PDF and the live form
 * stay in sync) and in `work_order._recalculate_totals_from_items`
 * (server-side safety net). Touch the three together.
 *
 * Credit-card rule (current spec): recargo lineal por cuota — `value`
 * se aplica N veces al total, dividido en N cuotas iguales (ver
 * `linearInstallmentRatio` arriba). Para métodos sin installments
 * (`applies_to_installments=false`) el recargo/descuento es un `value%`
 * flat del total.
 */
function applyPaymentMethodToTotals(
  pm: PaymentMethod | null,
  installments: number,
  totalArs: number,
  totalUsd: number,
  usdRate: number,
): { totalArs: number; totalUsd: number } {
  if (!pm || pm.type === 'NONE' || !pm.value) {
    return { totalArs, totalUsd };
  }
  const value = Number(pm.value) || 0;
  if (value <= 0) return { totalArs, totalUsd };

  // Effective ratio applied to the total (1 = no change).
  let ratio = 1;
  if (pm.applies_to_installments) {
    ratio = linearInstallmentRatio(value, installments);
  } else if (pm.is_percentage) {
    ratio = pm.type === 'DISCOUNT' ? 1 - value / 100 : 1 + value / 100;
  }
  if (ratio === 1) return { totalArs, totalUsd };

  if (pm.type === 'SURCHARGE') {
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
  if (pm.type === 'DISCOUNT') {
    if (pm.is_percentage) {
      return {
        totalArs: Math.max(0, Math.round(totalArs * ratio)),
        totalUsd: round2(Math.max(0, totalUsd * ratio)),
      };
    }
    return {
      totalArs: Math.max(0, totalArs - value),
      totalUsd:
        usdRate > 0
          ? round2(Math.max(0, totalUsd - value / usdRate))
          : totalUsd,
    };
  }
  return { totalArs, totalUsd };
}

/**
 * Build the per-cuota breakdown (3-column table the form + PDF render
 * next to the recargo). Only meaningful for credit-card percentage
 * surcharges with `applies_to_installments=True`; returns `[]` for
 * every other shape so callers can render unconditionally.
 *
 * Regla actual: las N cuotas son **uniformes** (todas iguales).
 * `interes` muestra el % por cuota (`value`, no `N × value`) — el
 * total del recargo (`N × value%`) ya está visible en la línea
 * "Recargo (X%)" del PDF. `monto` = total / N.
 */
function computeInstallmentDetail(
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

export function useBudgetCalculations(
  form: EntityFormState,
  setForm: React.Dispatch<React.SetStateAction<EntityFormState>>,
  paymentMethods: PaymentMethod[] = [],
) {
  // Stable stringified views of the JSON-shaped form slices, used both
  // in the effect for diff detection and as its dependency list (raw
  // array/object deps would alias across renders and skip re-runs).
  const fabricationDepsJson = JSON.stringify(form.fabrication_details);
  const materialsDepsJson = JSON.stringify(form.materials_data);
  const poolsDepsJson = JSON.stringify(form.pools_data);
  const additionalDepsJson = JSON.stringify(form.additional_works_data);
  const paymentMethodsDepsJson = JSON.stringify(
    paymentMethods.map((pm) => [pm.id, pm.type, pm.value, pm.is_percentage, pm.applies_to_installments]),
  );

  useEffect(() => {
    const fabricationDetails = form.fabrication_details || [];
    const materialsData = form.materials_data || [];
    const poolsData = form.pools_data || [];

    const altMaterialNames = new Set(
      materialsData.filter((m: MaterialInForm) => m.is_alternative).map((m) => m.name),
    );
    const isAltLinked = (materialField: string | null | undefined): boolean => {
      if (!materialField) return false;
      if (materialField === '__GLOBAL__') return false;
      if (materialField.startsWith('__ALT__:')) return true;
      return altMaterialNames.has(materialField);
    };

    const fabricationForMain = fabricationDetails.filter((d) => !isAltLinked(d.material));
    const poolsForMain = poolsData.filter((pt) => !isAltLinked(pt.material));

    const arsTotal = fabricationForMain.reduce(
      (sum: number, d: FabricationDetail) => sum + (d.currency === 'USD' ? 0 : (Number(d.price) || 0) * (d.quantity || 1)),
      0
    );
    const usdTotal = fabricationForMain.reduce(
      (sum: number, d: FabricationDetail) => sum + (d.currency === 'USD' ? (Number(d.price) || 0) * (d.quantity || 1) : 0),
      0
    );
    const dd = Number(form.usd_rate);
    const ppArs = poolsForMain
      .filter((pt: PoolInForm) => (pt.currency || 'ARS') !== 'USD')
      .reduce((sum: number, pt: PoolInForm) => sum + (pt.price || 0) * (pt.quantity || 1), 0);
    const ppUsd = poolsForMain
      .filter((pt: PoolInForm) => (pt.currency || 'ARS') === 'USD')
      .reduce((sum: number, pt: PoolInForm) => sum + (pt.price || 0) * (pt.quantity || 1), 0);

    const additionalWorksRaw = form.additional_works_data;
    let additionalWorksParsed: AdditionalWorkRow[] = [];
    if (typeof additionalWorksRaw === 'string' && additionalWorksRaw) {
      try { const p = JSON.parse(additionalWorksRaw); if (Array.isArray(p)) additionalWorksParsed = p as AdditionalWorkRow[]; }
      catch { /* ignore malformed JSON */ }
    }
    const additionalForMain = additionalWorksParsed.filter((a) => !isAltLinked(a.materialName));
    const additionalContribution = (a: AdditionalWorkRow): number => {
      if (a.type === 'frente') return Number(a.total ?? 0);
      return Number(a.total ?? (Number(a.price ?? 0) * Number(a.quantity ?? 1)));
    };
    const additionalArs = additionalForMain
      .filter((a) => (a.currency ?? 'ARS') !== 'USD')
      .reduce((sum, a) => sum + additionalContribution(a), 0);
    const additionalUsd = additionalForMain
      .filter((a) => (a.currency ?? 'ARS') === 'USD')
      .reduce((sum, a) => sum + additionalContribution(a), 0);

    const matsMain = materialsData.filter((m: MaterialInForm) => !m.is_alternative);
    const matArs = matsMain
      .filter((m: MaterialInForm) => m.currency !== 'USD')
      .reduce((sum: number, m: MaterialInForm) => sum + (Number(m.length || 0) * Number(m.width || 0) * (m.quantity || 1) * (m.price_m2 || 0)), 0);
    const matUsd = matsMain
      .filter((m: MaterialInForm) => m.currency === 'USD')
      .reduce((sum: number, m: MaterialInForm) => sum + (Number(m.length || 0) * Number(m.width || 0) * (m.quantity || 1) * (m.price_m2_usd || 0)), 0);

    const subtotal = arsTotal + (dd > 0 ? Math.round((usdTotal + matUsd) * dd * 100) / 100 : 0) + matArs + ppArs + (dd > 0 ? Math.round(ppUsd * dd * 100) / 100 : 0) + additionalArs + (dd > 0 ? Math.round(additionalUsd * dd * 100) / 100 : 0);
    const tr = Number(form.transport) || 0;
    const totalBase = Math.max(0, subtotal + tr);

    // Manual discount (operator-typed on the form).
    const descPct = Number(form.discount_percentage) || 0;
    const descFijo = Number(form.discount_fixed_amount) || 0;
    let totalConDescuento = totalBase;
    if (descPct > 0) {
      totalConDescuento = Math.round(totalBase * (1 - descPct / 100));
    } else if (descFijo > 0) {
      totalConDescuento = Math.max(0, totalBase - descFijo);
    }

    // Catalogue-driven discount / surcharge (replaces the legacy
    // hardcoded "TARJETA DE CRÉDITO + N*5%" rule).
    const pm = resolvePaymentMethod(form, paymentMethods);
    const installmentsCount = Math.max(1, Number(form.installments) || 1);
    const { totalArs: totalWithMethod } = applyPaymentMethodToTotals(
      pm,
      installmentsCount,
      totalConDescuento,
      0, // ARS-only path; USD mirror computed below
      dd,
    );
    const total = totalWithMethod;

    const depositArs = Number(form.deposit_received) || 0;
    const depositUsdVal = Number(form.deposit_usd) || 0;
    const depositTotalArs = depositArs + (dd > 0 ? depositUsdVal * dd : 0);
    const depositTotalUsd = depositUsdVal + (dd > 0 ? depositArs / dd : 0);
    const balanceDue = Math.max(0, total - depositTotalArs);

    // USD mirror
    const tr_usd = Number(form.transport_usd) || 0;
    const subtotal_usd = round2(usdTotal + matUsd + ppUsd + additionalUsd + (dd > 0 ? (arsTotal + matArs + ppArs + additionalArs) / dd : 0));
    const totalBaseUsd = Math.max(0, subtotal_usd + tr_usd);
    let totalConDescuentoUsd = totalBaseUsd;
    if (descPct > 0) {
      totalConDescuentoUsd = round2(totalBaseUsd * (1 - descPct / 100));
    } else if (descFijo > 0 && dd > 0) {
      totalConDescuentoUsd = round2(Math.max(0, totalBaseUsd - descFijo / dd));
    }
    const { totalUsd: totalUsdWithMethod } = applyPaymentMethodToTotals(
      pm,
      installmentsCount,
      totalConDescuentoUsd,
      totalConDescuentoUsd,
      dd,
    );
    const total_usd = totalUsdWithMethod;
    const balance_due_usd = Math.max(0, total_usd - depositTotalUsd);

    // Alternative material override (same shape as before; keeps the
    // alternative card's total in sync with the live form).
    const hasAlternative = materialsData.some((m: MaterialInForm) => m.is_alternative);
    let totalFinal = total;
    let totalUsdFinal = total_usd;
    let balanceDueFinal = balanceDue;
    let balanceDueUsdFinal = balance_due_usd;
    // `totalAltConDesc` / `totalAltConDescUsd` are the pre-catalogue
    // base when alternatives exist — the per-cuota breakdown uses them
    // so each row's `monto` is `base/N × (1 + n × value/100)`, not
    // `final/N × (1 + n × value/100)` (which would compound twice).
    let totalAltConDesc: number = totalConDescuento;
    let totalAltConDescUsd: number = totalConDescuentoUsd;
    if (hasAlternative) {
      const primeraAlt = materialsData.find((m: MaterialInForm) => m.is_alternative);
      if (primeraAlt) {
        const dd2 = dd || 1;
        const m2 = Number(primeraAlt.length || 0) * Number(primeraAlt.width || 0) * (primeraAlt.quantity || 1);
        const precioMat = primeraAlt.currency === 'USD' ? (primeraAlt.price_m2_usd || 0) : (primeraAlt.price_m2 || 0);
        const costoMatArs = primeraAlt.currency === 'USD' ? m2 * precioMat * dd2 : m2 * precioMat;
        const fijosArs = arsTotal + (dd2 > 0 ? usdTotal * dd2 : 0) + ppArs + (dd2 > 0 ? ppUsd * dd2 : 0) + additionalArs + (dd2 > 0 ? additionalUsd * dd2 : 0) + tr;
        const totalAlt = Math.round(costoMatArs + fijosArs);
        totalAltConDesc = descPct > 0 ? Math.round(totalAlt * (1 - descPct / 100)) : (descFijo > 0 ? Math.max(0, totalAlt - descFijo) : totalAlt);
        const { totalArs: totalAltConMethod } = applyPaymentMethodToTotals(
          pm,
          installmentsCount,
          totalAltConDesc,
          0,
          dd2,
        );
        totalFinal = totalAltConMethod;
        const costoMatUsd = primeraAlt.currency === 'USD' ? m2 * precioMat : m2 * precioMat / dd2;
        const fijosUsd = usdTotal + (dd2 > 0 ? arsTotal / dd2 : 0) + ppUsd + (dd2 > 0 ? ppArs / dd2 : 0) + additionalUsd + (dd2 > 0 ? additionalArs / dd2 : 0) + (dd2 > 0 ? tr / dd2 : 0);
        const totalAltUsd = Math.round((costoMatUsd + fijosUsd) * 100) / 100;
        totalAltConDescUsd = descPct > 0 ? totalAltUsd * (1 - descPct / 100) : (descFijo > 0 && dd2 > 0 ? Math.max(0, totalAltUsd - descFijo / dd2) : totalAltUsd);
        const { totalUsd: totalAltUsdWithMethod } = applyPaymentMethodToTotals(
          pm,
          installmentsCount,
          totalAltConDescUsd,
          totalAltConDescUsd,
          dd2,
        );
        totalUsdFinal = totalAltUsdWithMethod;
        balanceDueFinal = Math.max(0, totalFinal - depositTotalArs);
        balanceDueUsdFinal = Math.max(0, totalUsdFinal - depositTotalUsd);
      }
    }

    // Per-cuota breakdown (used by the form + PDF for the 3-column
    // table). Las N cuotas son **uniformes** — todas cargan el mismo
    // `interes` (el `value` del catálogo) y el mismo `monto`
    // (total con recargo / N). `interes` es el % por cuota, no el
    // total. La columna "Recargo (X%)" del PDF muestra el agregado
    // `N × value%` para que el cliente vea ambos niveles.
    // `totalFinal`/`totalUsdFinal` son el total **post-recargo**;
    // cuando hay alternativa, ya están computados contra el base
    // alternativa.
    const installmentDetail = computeInstallmentDetail(
      pm,
      installmentsCount,
      totalFinal,
      totalUsdFinal,
    );

    setForm((prev: EntityFormState) => ({
      ...prev,
      subtotal,
      total: totalFinal,
      subtotal_usd,
      total_usd: totalUsdFinal,
      balance_due: balanceDueFinal,
      balance_due_usd: balanceDueUsdFinal,
      installment_detail_ars: installmentDetail.ars,
      installment_detail_usd: installmentDetail.usd,
    }));
  }, [
    fabricationDepsJson,
    materialsDepsJson,
    poolsDepsJson,
    additionalDepsJson,
    paymentMethodsDepsJson,
    form.transport, form.transport_usd, form.usd_rate,
    form.payment_method, form.payment_method_id, form.installments,
    form.discount_percentage, form.discount_fixed_amount,
    form.deposit_received, form.deposit_usd, form.deposit_currency,
  ]);
}
