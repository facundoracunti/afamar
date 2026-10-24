/**
 * The document RULE SET: traslado, descuento comercial, recargo de
 * catálogo, tabla de cuotas, TOTAL and saldo.
 *
 * Split out of `buildPdfData.context.ts` so the numbers the PDF prints live
 * alone, next to the rows they are computed from
 * (`buildPdfData.rows.ts`).
 */

import { computeMaterialsSubtotal } from '@features/budgets/utils/commercialDiscount';
import type { PaymentMethod } from '../../types/paymentMethod';
import { computeTotals, applyPerSectionTotals } from './buildPdfData.totals';
import {
  computePaidTotals,
  resolvePaymentMethod,
} from './buildPdfData.helpers';
import { formNum, formStr } from './buildPdfData.form';
import type { DocumentRows } from './buildPdfData.rows';
import type {
  BuildAlternativeTotalsParams,
  DepositCurrency,
  InstallmentDetailRow,
  TotalsContext,
} from './buildPdfData.types';
import type { DocumentType } from './pdfTypes';

/** The document's monetary outputs. */
export interface DocumentRuleSet {
  transport: number;
  transportUsd: number;
  discountPct: number;
  discountFixedRaw: number;
  deposit: number;
  depositUsd: number;
  depositCurrency: DepositCurrency;
  installmentsNum: number;
  depositArsEquivalent: number;
  paidArs: number;
  paidUsd: number;
  paidLabel: string;
  computedTotal: number;
  computedTotalUsd: number;
  computedBalanceDue: number;
  discountFixed: number;
  surchargePct: number;
  surchargeAmount: number;
  catalogueSurchargePct: number;
  catalogueSurchargeAmount: number;
  catalogueDiscountPct: number;
  catalogueDiscountAmount: number;
  catalogueMethodLabel: string;
  catalogueInstallmentDetail: InstallmentDetailRow[];
  /** The document rule set WITHOUT the materials-only base — the params the
   *  consolidated alternatives and the per-option totals are valued with. */
  altParams: BuildAlternativeTotalsParams;
}

export interface DocumentRuleSetParams {
  /** The ORIGINAL form (source of the scalar fields). */
  form: Record<string, unknown>;
  rows: DocumentRows;
  document_type: DocumentType;
  paymentMethods: PaymentMethod[];
  totalPaid?: number;
}

/**
 * Run the document rule set over the gathered rows.
 */
export function computeDocumentRuleSet({
  form,
  rows,
  document_type,
  paymentMethods,
  totalPaid,
}: DocumentRuleSetParams): DocumentRuleSet {
  const str = (k: string): string => formStr(form, k);
  const num = (k: string): number => formNum(form, k);

  const { usdRate, allMaterials, sections, mainSection, globalSection, computedSubtotal } = rows;

  const transport = num('transport');
  const transportUsd = num('transport_usd');
  const discountFixedRaw = num('discount_fixed_amount');
  const discountPct = num('discount_percentage');
  const deposit = num('deposit_received');
  const depositUsd = num('deposit_usd');
  const depositCurrency: DepositCurrency =
    (str('deposit_currency') || 'ARS').toUpperCase() === 'USD' ? 'USD' : 'ARS';

  // Resolve the paid block: passes the ARS equivalent of the deposit
  // (deposit_usd * usd_rate when the seña was paid in USD) so the totals
  // rule set can compute balance_due = total - deposit_ars correctly
  // regardless of the deposit's native currency. For work orders
  // WorkOrderFormPage passes `totalPaid` = seña del form + pagos del módulo
  // de la sesión, so the preview updates live when a payment is registered
  // and the saldo derives from there (Paid + Saldo = TOTAL, igual que el
  // builder legacy en pdf_html.py). Sin `totalPaid` (budgets / previews
  // legacy) cae al equivalente ARS de la seña.
  const {
    depositArsEquivalent,
    paidArs,
    paidUsd,
    paidLabel,
  } = computePaidTotals({
    deposit,
    depositUsd,
    depositCurrency,
    usdRate,
    document_type,
    totalPaid,
  });

  const paymentMethodRaw = str('payment_method');
  const paymentMethodIdNum = num('payment_method_id') || null;
  const installmentsNum = num('installments') || 1;

  // Fase 3 — Descuento Comercial (frontend, budgets). `discount_enabled`
  // gates the percentage discount; `discount_target` picks the base the %
  // runs against (whole document or main materials only). The materials
  // base comes from `computeMaterialsSubtotal`, the single source shared
  // with `useBudgetCalculations` (mirrors its `matArs` / `matUsd`).
  const discountEnabled = form.discount_enabled === true;
  const discountTarget: 'total' | 'materials' =
    form.discount_target === 'materials' ? 'materials' : 'total';
  const materialsTotals = computeMaterialsSubtotal(allMaterials, usdRate);

  // Resolve the catalogue row for the current method (same lookup as
  // `useBudgetCalculations.resolvePaymentMethod`).
  const pm = resolvePaymentMethod(paymentMethods, paymentMethodIdNum, paymentMethodRaw);

  // Document-level totals — the "representative" total used by the base PDF
  // data (and by a PRINCIPAL page when it exists). Shares the exact same
  // rule set with the per-section totals below via `computeTotals`.
  const mainSectionSubtotalUsd = mainSection
    ? mainSection.subtotal_usd
    : globalSection
      ? globalSection.subtotal_usd
      : 0;
  const totalsContext: TotalsContext = {
    transport,
    transportUsd,
    discountPct,
    discountFixedRaw,
    usdRate,
    pm,
    installments: installmentsNum,
    deposit: paidArs,
    discountEnabled,
    discountTarget,
    materialsSubtotalArs: materialsTotals.materialsSubtotalArs,
    materialsSubtotalUsd: materialsTotals.materialsSubtotalUsd,
  };
  const totals = computeTotals({
    subtotalArs: computedSubtotal,
    subtotalUsd: mainSectionSubtotalUsd,
    ...totalsContext,
  });
  const {
    discount_fixed_amount: discountFixed,
    surcharge_percentage: surchargePct,
    surcharge_amount: surchargeAmount,
    catalogue_surcharge_percentage: catalogueSurchargePct,
    catalogue_surcharge_amount: catalogueSurchargeAmount,
    catalogue_discount_percentage: catalogueDiscountPct,
    catalogue_discount_amount: catalogueDiscountAmount,
    catalogue_method_label: catalogueMethodLabel,
    catalogue_installment_detail: catalogueInstallmentDetail,
    total: computedTotal,
    total_usd: computedTotalUsd,
    balance_due: computedBalanceDue,
  } = totals;

  // No main material + at least one alternative: value EVERY alternative's
  // own final price so each option page shows its correct total (dólar,
  // recargo, descuento, saldo) — works for any number of alternatives.
  if (!mainSection && !globalSection) {
    applyPerSectionTotals(sections, totalsContext);
  }

  // The document rule set WITHOUT the materials-only base — the params the
  // consolidated alternatives and the per-option totals are valued with.
  const altParams: BuildAlternativeTotalsParams = {
    transport,
    transportUsd,
    discountPct,
    discountFixedRaw,
    usdRate,
    pm,
    installments: installmentsNum,
    deposit: paidArs,
    discountEnabled,
    discountTarget,
  };

  return {
    transport,
    transportUsd,
    discountPct,
    discountFixedRaw,
    deposit,
    depositUsd,
    depositCurrency,
    installmentsNum,
    depositArsEquivalent,
    paidArs,
    paidUsd,
    paidLabel,
    computedTotal,
    computedTotalUsd,
    computedBalanceDue,
    discountFixed,
    surchargePct,
    surchargeAmount,
    catalogueSurchargePct,
    catalogueSurchargeAmount,
    catalogueDiscountPct,
    catalogueDiscountAmount,
    catalogueMethodLabel,
    catalogueInstallmentDetail,
    altParams,
  };
}
