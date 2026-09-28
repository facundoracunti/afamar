/**
 * Totals engine for the PDF data builders.
 *
 * Contains the single source of truth for the document total rule set
 * (`computeTotals`: subtotal → traslado → descuento comercial → recargo de
 * catálogo → tablas de cuotas → TOTAL → saldo) plus the helper that values
 * EVERY alternative section when a budget has no main material.
 *
 * The same `computeTotals` also feeds `buildAlternativeTotals` (consolidated
 * per-material TOTAL GENERAL ALTERNATIVO) so the whole document shares one
 * rule set — mirrors `useBudgetCalculations` and the backend
 * `_recalculate_totals_from_items`.
 */

import { round2 } from '../math';
import type { MaterialSection } from './pdfTypes';
import type {
  ComputeTotalsParams,
  ComputeTotalsResult,
  InstallmentDetailRow,
  TotalsContext,
} from './buildPdfData.types';

/**
 * Compute the full totals breakdown (discount + catalogue surcharge /
 * discount + per-cuota table + saldo) starting from a given subtotal.
 *
 * Parametrized on the subtotal so the SAME rule set can value the
 * document-level totals (representative alternative) AND every individual
 * alternative page — this is what lets a no-principal budget show each
 * option's own final price. Mirrors `useBudgetCalculations` and the
 * backend `_recalculate_totals_from_items`.
 */
export function computeTotals({
  subtotalArs,
  subtotalUsd,
  transport,
  transportUsd,
  discountPct,
  discountFixedRaw,
  usdRate,
  pm,
  installments,
  deposit,
  discountEnabled,
  discountTarget,
  materialsSubtotalArs,
  materialsSubtotalUsd,
}: ComputeTotalsParams): ComputeTotalsResult {
  const discountOn = discountEnabled === undefined || discountEnabled === null
    ? discountPct > 0
    : discountEnabled;
  const totalBase = subtotalArs + transport;
  const discountBase = discountTarget === 'materials'
    ? (materialsSubtotalArs ?? totalBase)
    : totalBase;
  const discountFixed = discountFixedRaw > 0
    ? discountFixedRaw
    : (discountOn && discountPct > 0)
      ? Math.round(discountBase * discountPct) / 100
      : 0;

  const surchargeBase = Math.max(0, subtotalArs + transport - discountFixed);
  let totalArs = surchargeBase;

  let surchargePct = 0;
  let surchargeAmount = 0;
  let catalogueSurchargePct = 0;
  let catalogueSurchargeAmount = 0;
  const catalogueDiscountPct = 0;
  const catalogueDiscountAmount = 0;
  let catalogueMethodLabel = '';
  // Only SURCHARGE methods adjust the totals (credit-card recargo, etc.).
  // NONE and DISCOUNT are purely informational — the legacy promotional
  // cash discount (`apply_cash_discount`) was removed; every discount now
  // flows through the commercial discount (Fase 3) only. The
  // `catalogue_discount_*` fields below stay (always 0) so the template
  // can keep rendering them.
  if (
    pm
    && pm.type === 'SURCHARGE'
    && Number(pm.value) > 0
  ) {
    const value = Number(pm.value);
    // Fixed-amount surcharges apply directly (no ratio) — mirror of
    // `applyPaymentMethodToTotals` in useBudgetCalculations.ts. A fixed
    // SURCHARGE (`is_percentage=false`, `applies_to_installments=false`)
    // leaves `ratio` at 1, so it must NOT share the `ratio !== 1` gate
    // below or it would never surface.
    const isFixedAmount = !pm.is_percentage && !pm.applies_to_installments;
    if (isFixedAmount) {
      catalogueSurchargeAmount = value;
      surchargeAmount = value;
      totalArs = Math.round(surchargeBase + value);
      catalogueMethodLabel = pm.label || pm.name;
    } else {
      let ratio = 1;
      if (pm.applies_to_installments) {
        const n = Math.max(1, installments);
        ratio = 1 + n * (value / 100);
      } else if (pm.is_percentage) {
        ratio = 1 + value / 100;
      }
      if (ratio !== 1) {
        if (pm.is_percentage) {
          const headlinePct = round2((ratio - 1) * 100);
          catalogueSurchargePct = headlinePct;
          surchargePct = headlinePct;
          catalogueSurchargeAmount = Math.round(surchargeBase * (ratio - 1));
          surchargeAmount = catalogueSurchargeAmount;
        } else {
          catalogueSurchargeAmount = value;
          surchargeAmount = value;
        }
        totalArs = Math.round(surchargeBase * ratio);
        catalogueMethodLabel = pm.label || pm.name;
      }
    }
  }

  const totalArsFinal = totalArs;
  const balanceDue = Math.max(0, totalArsFinal - deposit);

  // Per-cuota breakdown (3-column table), only for credit-card %
  // surcharges with installments — same rule as the ARS total above.
  const catalogueInstallmentDetail: InstallmentDetailRow[] = [];
  if (
    pm
    && pm.type === 'SURCHARGE'
    && pm.is_percentage
    && pm.applies_to_installments
    && Number(pm.value) > 0
    && installments >= 1
  ) {
    const value = Number(pm.value);
    const n = Math.max(1, installments);
    const perCuota = totalArsFinal > 0 ? round2(totalArsFinal / n) : 0;
    for (let i = 1; i <= n; i += 1) {
      catalogueInstallmentDetail.push({ cuota: i, interes: value, monto: perCuota });
    }
  }

  // USD side (mirrors the ARS block above).
  const totalBaseUsd = subtotalUsd + transportUsd;
  const discountBaseUsd = discountTarget === 'materials'
    ? (materialsSubtotalUsd ?? totalBaseUsd)
    : totalBaseUsd;
  const discountFixedUsd = (discountOn && discountPct > 0)
    ? Math.round(discountBaseUsd * discountPct) / 100
    : discountFixedRaw > 0 && usdRate > 0
      ? Math.round((discountFixedRaw / usdRate) * 100) / 100
      : 0;
  const surchargeBaseUsd = Math.max(0, subtotalUsd + transportUsd - discountFixedUsd);
  let totalUsd = surchargeBaseUsd;
  if (
    pm
    && pm.type === 'SURCHARGE'
    && Number(pm.value) > 0
  ) {
    const value = Number(pm.value);
    // Fixed-amount surcharges apply directly (no ratio) — mirror of the
    // ARS block above. Must NOT share the `ratio !== 1` gate.
    const isFixedAmountUsd = !pm.is_percentage && !pm.applies_to_installments;
    if (isFixedAmountUsd) {
      totalUsd = usdRate > 0 ? round2(surchargeBaseUsd + value / usdRate) : surchargeBaseUsd;
    } else {
      let ratio = 1;
      if (pm.applies_to_installments) {
        const n = Math.max(1, installments);
        ratio = 1 + n * (value / 100);
      } else if (pm.is_percentage) {
        ratio = 1 + value / 100;
      }
      if (ratio !== 1) {
        if (pm.is_percentage) {
          totalUsd = round2(surchargeBaseUsd * ratio);
        } else if (usdRate > 0) {
          totalUsd = round2(surchargeBaseUsd + value / usdRate);
        }
      }
    }
  }
  totalUsd = Math.max(0, totalUsd);

  return {
    subtotal: subtotalArs,
    discount_fixed_amount: discountFixed,
    surcharge_percentage: surchargePct,
    surcharge_amount: surchargeAmount,
    catalogue_surcharge_percentage: catalogueSurchargePct,
    catalogue_surcharge_amount: catalogueSurchargeAmount,
    catalogue_discount_percentage: catalogueDiscountPct,
    catalogue_discount_amount: catalogueDiscountAmount,
    catalogue_method_label: catalogueMethodLabel,
    catalogue_installment_detail: catalogueInstallmentDetail,
    total: totalArsFinal,
    total_usd: totalUsd,
    balance_due: balanceDue,
  };
}

/**
 * No main material + at least one alternative: value EVERY alternative's
 * own final price so each option page shows its correct total (dólar,
 * recargo, descuento, saldo) — works for any number of alternatives.
 * Runs `computeTotals` per section with the document's shared rule set and
 * writes the per-option totals back onto each section.
 */
export function applyPerSectionTotals(
  sections: MaterialSection[],
  ctx: TotalsContext,
): void {
  for (const section of sections) {
    const st = computeTotals({
      subtotalArs: section.subtotal_ars,
      subtotalUsd: section.subtotal_usd,
      ...ctx,
    });
    section.total_ars = st.total;
    section.total_usd = st.total_usd;
    section.balance_due = st.balance_due;
    section.discount_fixed_amount = st.discount_fixed_amount;
    section.surcharge_percentage = st.surcharge_percentage;
    section.surcharge_amount = st.surcharge_amount;
    section.catalogue_installment_detail = st.catalogue_installment_detail;
  }
}