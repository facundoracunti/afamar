import { useEffect, useRef } from 'react';
import type { EntityFormState, FabricationDetail, MaterialInForm, PoolInForm } from '../types';
import type { PaymentMethod } from '../types/paymentMethod';
import { round2 } from '../utils/math';
import {
  applyPaymentMethodToTotals,
  computeInstallmentDetail,
  resolvePaymentMethod,
} from './calculations/paymentMethod';

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

// Re-export the payment-method helpers from the calculations module so
// older call sites that imported them directly from
// ``useBudgetCalculations`` keep working (the actual implementations live
// in ``./calculations/paymentMethod.ts``).
export {
  applyPaymentMethodToTotals,
  computeInstallmentDetail,
  resolvePaymentMethod,
} from './calculations/paymentMethod';

export function useBudgetCalculations(
  form: EntityFormState,
  setForm: React.Dispatch<React.SetStateAction<EntityFormState>>,
  paymentMethods: PaymentMethod[] = [],
  options: { freezeExistingWorkOrder?: boolean } = {},
) {
  const freezeExistingWorkOrder = options.freezeExistingWorkOrder === true;
  const commercialSignatureRef = useRef<string | null>(null);
  const depositSignatureRef = useRef<string | null>(null);
  const frozenRateRef = useRef<number | null>(null);
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

  // Measurement fields are deliberately excluded. They are edited during
  // MEDICION, but do not represent a new commercial quote for an existing OT.
  // The backend applies the same distinction before persisting a PATCH.
  const commercialSignature = JSON.stringify({
    materials: JSON.parse(materialsDepsJson || '[]').map((row: Record<string, unknown>) => {
      const copy = { ...row };
      for (const key of ['length', 'width', 'quantity', 'largo', 'ancho', 'cantidad', 'm2', 'm2_used', 'm2_budgeted']) delete copy[key];
      return copy;
    }),
    fabrication: JSON.parse(fabricationDepsJson || '[]').map((row: Record<string, unknown>) => {
      const copy = { ...row };
      for (const key of ['length', 'width', 'quantity', 'largo', 'ancho', 'cantidad', 'linear_meters', 'metros_lineales', 'm2_budgeted', 'linear_meters_budgeted', 'total_ars_budgeted', 'total_usd_budgeted']) delete copy[key];
      return copy;
    }),
    additional: (() => {
      try {
        const rows = typeof form.additional_works_data === 'string' && form.additional_works_data
          ? JSON.parse(form.additional_works_data)
          : [];
        return (Array.isArray(rows) ? rows : []).map((row: Record<string, unknown>) => {
          const copy = { ...row };
          if (String(copy.type || '').toLowerCase() === 'frente') delete copy.linear_meters;
          for (const key of ['linear_meters_budgeted', 'total_ars_budgeted', 'total_usd_budgeted']) delete copy[key];
          return copy;
        });
      } catch {
        return [];
      }
    })(),
    pools: JSON.parse(poolsDepsJson || '[]'),
    transport: form.transport,
    transport_usd: form.transport_usd,
    discount_enabled: form.discount_enabled,
    discount_target: form.discount_target,
    discount_percentage: form.discount_percentage,
    discount_fixed_amount: form.discount_fixed_amount,
    payment_method: form.payment_method,
    payment_method_id: form.payment_method_id,
    installments: form.installments,
  });
  const depositSignature = JSON.stringify({
    deposit_received: form.deposit_received,
    deposit_usd: form.deposit_usd,
    deposit_currency: form.deposit_currency,
  });

  useEffect(() => {
    if (freezeExistingWorkOrder) {
      // `number` is empty until the GET response hydrates an existing form.
      // Never run the new-document calculator against that empty pre-load
      // state, and capture the API values as the commercial baseline.
      if (!form.number) return;
      if (commercialSignatureRef.current === null) {
        commercialSignatureRef.current = commercialSignature;
        depositSignatureRef.current = depositSignature;
        frozenRateRef.current = Number(form.usd_rate) || 0;
        return;
      }
      const commercialChanged = commercialSignatureRef.current !== commercialSignature;
      const depositChanged = depositSignatureRef.current !== depositSignature;
      commercialSignatureRef.current = commercialSignature;
      depositSignatureRef.current = depositSignature;

      // A rate refresh must never replace the historical quote of an existing
      // OT. The backend also ignores it on measurement-only updates.
      if (frozenRateRef.current !== null && Number(form.usd_rate) !== frozenRateRef.current) {
        const historicalRate = frozenRateRef.current;
        setForm((prev) => prev.usd_rate === historicalRate ? prev : { ...prev, usd_rate: historicalRate });
      }

      if (!commercialChanged) {
        if (depositChanged) {
          const rate = frozenRateRef.current || Number(form.usd_rate) || 0;
          const paidArs = String(form.deposit_currency || 'ARS').toUpperCase() === 'USD'
            ? (Number(form.deposit_usd) || 0) * rate
            : Number(form.deposit_received) || 0;
          const paidUsd = String(form.deposit_currency || 'ARS').toUpperCase() === 'USD'
            ? Number(form.deposit_usd) || 0
            : rate > 0 ? (Number(form.deposit_received) || 0) / rate : 0;
          setForm((prev) => ({
            ...prev,
            balance_due: Math.max(0, (Number(prev.total) || 0) - paidArs),
            balance_due_usd: Math.max(0, Math.round(((Number(prev.total_usd) || 0) - paidUsd) * 100) / 100),
          }));
        }
        return;
      }
    }

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

    // Commercial discount (Fase 3 — budgets feature). Gated by
    // `discount_enabled`: when off (default) the percentage never applies.
    // `discount_target` picks the base — 'total' = the whole document,
    // 'materials' = only the main materials (mármol/granito/cuarzo),
    // protecting mano de obra, trasforos, piletas e ingletados. The fixed
    // amount stays legacy (no gate, no UI).
    const descEnabled = form.discount_enabled === true;
    const descTarget: 'total' | 'materials' =
      form.discount_target === 'materials' ? 'materials' : 'total';
    const descPct = Number(form.discount_percentage) || 0;
    const descFijo = Number(form.discount_fixed_amount) || 0;
    const materialsBaseArs = matArs + (dd > 0 ? Math.round(matUsd * dd * 100) / 100 : 0);
    let discountAmount = 0;
    let totalConDescuento = totalBase;
    if (descEnabled && descPct > 0) {
      const base = descTarget === 'materials' ? materialsBaseArs : totalBase;
      discountAmount = Math.round(base * descPct) / 100;
      totalConDescuento = Math.max(0, Math.round((totalBase - discountAmount) * 100) / 100);
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

    const depositCurrency = form.deposit_currency || 'ARS';
    const depositArs = Number(form.deposit_received) || 0;
    const depositUsdVal = Number(form.deposit_usd) || 0;
    // La seña se cuenta SOLO en su moneda activa (deposit_currency). El otro
    // campo (deposit_received o deposit_usd) es el "espejo" que el sistema
    // guarda para mostrar la otra columna y NO debe sumarse otra vez — si no,
    // el saldo pendiente se subcuenta (suma seña en ARS y en USD a la vez) y
    // puede clamar a 0 aunque haya saldo real.
    const depositTotalArs = depositCurrency === 'USD'
      ? (dd > 0 ? depositUsdVal * dd : 0)
      : depositArs;
    const depositTotalUsd = depositCurrency === 'ARS'
      ? (dd > 0 ? depositArs / dd : 0)
      : depositUsdVal;
    const balanceDue = Math.max(0, total - depositTotalArs);

    // USD mirror
    const tr_usd = Number(form.transport_usd) || 0;
    const subtotal_usd = round2(usdTotal + matUsd + ppUsd + additionalUsd + (dd > 0 ? (arsTotal + matArs + ppArs + additionalArs) / dd : 0));
    const totalBaseUsd = Math.max(0, subtotal_usd + tr_usd);
    const materialsBaseUsd = matUsd + (dd > 0 ? matArs / dd : 0);
    let discountAmountUsd = 0;
    let totalConDescuentoUsd = totalBaseUsd;
    if (descEnabled && descPct > 0) {
      const baseUsd = descTarget === 'materials' ? materialsBaseUsd : totalBaseUsd;
      discountAmountUsd = round2((baseUsd * descPct) / 100);
      totalConDescuentoUsd = round2(Math.max(0, totalBaseUsd - discountAmountUsd));
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
        totalAltConDesc = descEnabled && descPct > 0
          ? Math.max(0, Math.round(totalAlt - (descTarget === 'materials' ? costoMatArs : totalAlt) * descPct / 100))
          : (descFijo > 0 ? Math.max(0, totalAlt - descFijo) : totalAlt);
        if (descEnabled && descPct > 0) {
          discountAmount = Math.max(0, Math.round((descTarget === 'materials' ? costoMatArs : totalAlt) * descPct) / 100);
        }
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
        totalAltConDescUsd = descEnabled && descPct > 0
          ? round2(Math.max(0, totalAltUsd - (descTarget === 'materials' ? costoMatUsd : totalAltUsd) * descPct / 100))
          : (descFijo > 0 && dd2 > 0 ? Math.max(0, totalAltUsd - descFijo / dd2) : totalAltUsd);
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
      discount_amount: discountAmount,
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
    form.discount_enabled, form.discount_target,
    form.deposit_received, form.deposit_usd, form.deposit_currency,
    freezeExistingWorkOrder, commercialSignature, depositSignature,
  ]);
}
