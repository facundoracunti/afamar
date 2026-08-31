/**
 * Build the data payload that the <DocumentPdf/> render expects.
 *
 * This is a TypeScript / frontend port of the Python helpers
 * `app/services/pdf_html.py::build_budget_pdf_data` and
 * `build_work_order_pdf_data` from the afamar-backend. The output shape
 * matches the props documented by `<DocumentPdf/>` in
 * `components/ui/PdfPreviewModal/DocumentPdf.tsx`.
 *
 * The frontend takes ownership of rendering PDFs in the browser today,
 * so these helpers replaced the backend Jinja2 + xhtml2pdf pipeline.
 */

import { POOL_MATERIAL_GLOBAL } from '../../types/budget';
import type { PaymentMethod } from '../../types/paymentMethod';
import { round2 } from '../math';
import { FRENTE_FORMULA_MULTIPLIER_DEFAULT } from '../frentePricing';
import type {
  DocumentType,
  PdfDataRow,
  MaterialPdfRow,
  PoolPdfRow,
  AdditionalWorkPdfRow,
  PdfDocumentData,
  BuildPdfDataParams,
  MaterialSection,
} from './pdfTypes';
import {
  STATUS_SUB_MAP,
  formatDate,
  fmtMoney,
  fmtMeasureUnit,
  fmtNum,
  splitTerms,
} from './pdfHelpers';
import {
  buildFabricationRows,
  asMaterials,
  asPools,
  buildSections,
  buildMeasurementComparison,
} from './buildSectionData';

function buildAdditionalWorksRows(
  form: Record<string, unknown>,
  usdRate: number,
): AdditionalWorkPdfRow[] {
  const additionalWorksRaw = (form as { additional_works_data?: unknown }).additional_works_data;
  let additionalWorksParsed: Array<Record<string, unknown>> = [];
  if (typeof additionalWorksRaw === 'string' && additionalWorksRaw) {
    try {
      const parsed = JSON.parse(additionalWorksRaw);
      if (Array.isArray(parsed)) {
        additionalWorksParsed = parsed as Array<Record<string, unknown>>;
      }
    } catch {
      // Malformed JSON → render as empty.
    }
  } else if (Array.isArray(additionalWorksRaw)) {
    additionalWorksParsed = additionalWorksRaw as Array<Record<string, unknown>>;
  }

  return additionalWorksParsed.map((row) => {
    const name = String(row['name'] ?? '');
    const detail = (row['detail'] as string | null | undefined) ?? null;
    const currency = (row['currency'] === 'USD' ? 'USD' : 'ARS') as 'ARS' | 'USD';
    const price = Number(row['price']) || 0;
    const quantity = Number(row['quantity']) || 1;
    const totalInSourceCurrency = Number(row['total']) || (price * quantity);
    const rowType: 'flat' | 'frente' = row['type'] === 'frente' ? 'frente' : 'flat';
    const formulaValues = (row['formula_values'] as Record<string, unknown> | null | undefined) ?? null;
    const rawMaterialName = (row['materialName'] ?? row['material_name'] ?? '') as string;
    const material_name = rawMaterialName && rawMaterialName !== POOL_MATERIAL_GLOBAL
      ? rawMaterialName
      : POOL_MATERIAL_GLOBAL;
    const rawAssignedId = row['assigned_material_id'];
    const assigned_material_id = rawAssignedId === null || rawAssignedId === undefined
      ? null
      : (Number.isFinite(Number(rawAssignedId)) ? Number(rawAssignedId) : null);

    const base: AdditionalWorkPdfRow = {
      name,
      detail,
      currency,
      price_str: fmtMoney(price),
      quantity,
      subtotal_ars: currency === 'ARS' ? totalInSourceCurrency : (usdRate > 0 ? totalInSourceCurrency * usdRate : 0),
      subtotal_usd: currency === 'USD' ? totalInSourceCurrency : (usdRate > 0 ? totalInSourceCurrency / usdRate : 0),
      material_name,
      assigned_material_id,
    };

    if (rowType !== 'frente') return base;

    const linearMeters = Number(row['linear_meters']) || 0;
    const m2AtSelection = Number(formulaValues?.['material_price_m2_at_selection']) || 0;
    const multiplier = Number(formulaValues?.['multiplier'] ?? formulaValues?.['constant']);

    return {
      ...base,
      type: 'frente',
      quantity: linearMeters,
      linear_meters_str: linearMeters > 0
        ? fmtMeasureUnit(linearMeters, 'ml')
        : null,
      linear_meters: linearMeters,
      multiplier: Number.isFinite(multiplier) ? multiplier : FRENTE_FORMULA_MULTIPLIER_DEFAULT,
      material_price_per_m2_str: m2AtSelection > 0 ? fmtMoney(m2AtSelection) : null,
      formula_constant_str: Number.isFinite(multiplier) ? fmtMoney(multiplier) : null,
    };
  });
}

function bucketAdditionalWorks(additional_works: AdditionalWorkPdfRow[]): {
  additionalByMaterial: Record<string, AdditionalWorkPdfRow[]>;
  additionalCommon: AdditionalWorkPdfRow[];
} {
  const adtByMaterial: Record<string, AdditionalWorkPdfRow[]> = {};
  const adtCommon: AdditionalWorkPdfRow[] = [];
  for (const row of additional_works) {
    const key = row.material_name ?? POOL_MATERIAL_GLOBAL;
    const isAlt = typeof key === 'string' && key.startsWith('__ALT__:');
    const bucketKey = isAlt ? key.slice('__ALT__:'.length) : key;
    // An unassigned frente (no catalogue material id) is GLOBAL — shown in
    // every option — even when a legacy `material_name` still carries a name
    // (budget-4 regression: the frente renders as "global" in the picker but
    // was only bucketed into its stale ZIRCONIUM section). In an
    // alternatives-only budget it is revalued with each option's material.
    const isUnassignedFrente =
      row.type === 'frente' && (row.assigned_material_id == null || row.assigned_material_id === '');
    if (isUnassignedFrente || !bucketKey || bucketKey === POOL_MATERIAL_GLOBAL) {
      adtCommon.push(row);
    } else {
      if (!adtByMaterial[bucketKey]) adtByMaterial[bucketKey] = [];
      adtByMaterial[bucketKey].push(row);
    }
  }
  return { additionalByMaterial: adtByMaterial, additionalCommon: adtCommon };
}

/**
 * Build the per-option `MaterialSection[]` for a budget's ALTERNATIVES,
 * reusing the exact same orchestration as the PDF. Each option section
 * already carries its OWN fully-revalued subtotal (material base + zócalo /
 * frente revalued with that option's material + traforos + pileta) — the
 * ground truth the alternative cards in the form must mirror so they show
 * the same SUBTOTAL the PDF draws.
 *
 * Intended for the QUOTE OPTIONS GRID (not the PDF renderer). Kept separate
 * from `buildPdfData` so the form cards and the rendered PDF can never drift
 * on the per-option total.
 */
export function buildAlternativeSections(
  form: Record<string, unknown>,
): { sections: MaterialSection[]; usdRate: number } {
  const allMaterials = asMaterials(form.materials_data);
  const alternatives = allMaterials.filter((m) => m.is_alternative);
  const pools = asPools(form.pools_data);
  const usdRate = Number(form.usd_rate) || 1;
  const fabricationRows = buildFabricationRows(form.fabrication_details, usdRate);
  const additional_works = buildAdditionalWorksRows(form, usdRate);
  const adtBuckets = bucketAdditionalWorks(additional_works);
  const { sections } = buildSections(
    allMaterials,
    alternatives,
    pools,
    fabricationRows,
    usdRate,
    adtBuckets,
  );
  return { sections, usdRate };
}

interface ComputeTotalsParams {
  subtotalArs: number;
  subtotalUsd: number;
  transport: number;
  transportUsd: number;
  discountPct: number;
  discountFixedRaw: number;
  usdRate: number;
  pm: PaymentMethod | null;
  installments: number;
  deposit: number;
  /** Per-order opt-in flag mirroring `work_orders.apply_cash_discount`.
   *  When false the DISCOUNT branch is skipped entirely so the total
   *  equals the subtotal regardless of the selected method's discount %. */
  applyCashDiscount: boolean;
}

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
  applyCashDiscount,
}: ComputeTotalsParams): {
  subtotal: number;
  discount_fixed_amount: number;
  surcharge_percentage: number;
  surcharge_amount: number;
  catalogue_surcharge_percentage: number;
  catalogue_surcharge_amount: number;
  catalogue_discount_percentage: number;
  catalogue_discount_amount: number;
  catalogue_method_label: string;
  catalogue_installment_detail: Array<{ cuota: number; interes: number; monto: number }>;
  total: number;
  total_usd: number;
  balance_due: number;
} {
  const discountBase = subtotalArs + transport;
  const discountFixed = discountFixedRaw > 0
    ? discountFixedRaw
    : discountPct > 0
      ? Math.round(discountBase * discountPct) / 100
      : 0;

  const surchargeBase = Math.max(0, subtotalArs + transport - discountFixed);
  let totalArs = surchargeBase;

  let surchargePct = 0;
  let surchargeAmount = 0;
  let catalogueSurchargePct = 0;
  let catalogueSurchargeAmount = 0;
  let catalogueDiscountPct = 0;
  let catalogueDiscountAmount = 0;
  let catalogueMethodLabel = '';
  if (
    pm
    && pm.type !== 'NONE'
    && Number(pm.value) > 0
    && (pm.type !== 'DISCOUNT' || applyCashDiscount)
  ) {
    const value = Number(pm.value);
    let ratio = 1;
    if (pm.applies_to_installments) {
      const n = Math.max(1, installments);
      ratio = 1 + n * (value / 100);
    } else if (pm.is_percentage) {
      ratio = pm.type === 'DISCOUNT' ? 1 - value / 100 : 1 + value / 100;
    }
    if (ratio !== 1) {
      if (pm.type === 'SURCHARGE') {
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
      } else if (pm.type === 'DISCOUNT') {
        if (pm.is_percentage) {
          catalogueDiscountPct = round2((1 - ratio) * 100);
          catalogueDiscountAmount = Math.round(surchargeBase * (1 - ratio));
          totalArs = Math.max(0, Math.round(surchargeBase * ratio));
        } else {
          catalogueDiscountAmount = value;
          totalArs = Math.max(0, surchargeBase - value);
        }
      }
      catalogueMethodLabel = pm.label || pm.name;
    }
  }

  const totalArsFinal = totalArs;
  const balanceDue = Math.max(0, totalArsFinal - deposit);

  // Per-cuota breakdown (3-column table), only for credit-card %
  // surcharges with installments — same rule as the ARS total above.
  let catalogueInstallmentDetail: Array<{ cuota: number; interes: number; monto: number }> = [];
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
  const discountBaseUsd = subtotalUsd + transportUsd;
  const discountFixedUsd = discountPct > 0
    ? Math.round(discountBaseUsd * discountPct) / 100
    : discountFixedRaw > 0 && usdRate > 0
      ? Math.round((discountFixedRaw / usdRate) * 100) / 100
      : 0;
  const surchargeBaseUsd = Math.max(0, subtotalUsd + transportUsd - discountFixedUsd);
  let totalUsd = surchargeBaseUsd;
  if (
    pm
    && pm.type !== 'NONE'
    && Number(pm.value) > 0
    && (pm.type !== 'DISCOUNT' || applyCashDiscount)
  ) {
    const value = Number(pm.value);
    let ratio = 1;
    if (pm.applies_to_installments) {
      const n = Math.max(1, installments);
      ratio = 1 + n * (value / 100);
    } else if (pm.is_percentage) {
      ratio = pm.type === 'DISCOUNT' ? 1 - value / 100 : 1 + value / 100;
    }
    if (ratio !== 1) {
      if (pm.type === 'SURCHARGE') {
        if (pm.is_percentage) {
          totalUsd = round2(surchargeBaseUsd * ratio);
        } else if (usdRate > 0) {
          totalUsd = round2(surchargeBaseUsd + value / usdRate);
        }
      } else if (pm.type === 'DISCOUNT') {
        if (pm.is_percentage) {
          totalUsd = round2(Math.max(0, surchargeBaseUsd * ratio));
        } else if (usdRate > 0) {
          totalUsd = round2(Math.max(0, surchargeBaseUsd - value / usdRate));
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
 * Build the canonical PDF data object from the current `EntityFormState`.
 *
 * Used by both the preview modal (in /admin/budgets/new and
 * /admin/work-orders/new) and the eventual download button.
 */
export function buildPdfData({
  form,
  document_type,
  overrides,
  company,
  globalTerms,
  sketchImages = [],
  paymentMethods = [],
}: BuildPdfDataParams): PdfDocumentData {
  const str = (k: string): string => (form[k] as string | null | undefined) ?? '';
  const num = (k: string): number => Number(form[k]) || 0;

  const allMaterials = asMaterials(form.materials_data);
  const mainMaterials = allMaterials.filter((m) => !m.is_alternative);
  const alternatives = allMaterials.filter((m) => m.is_alternative);
  const pools = asPools(form.pools_data);
  const usdRate = num('usd_rate');

  const fabricationRows = buildFabricationRows(form.fabrication_details, usdRate);

  const additional_works = buildAdditionalWorksRows(form, usdRate);
  const additionalWorksSubtotalArs = additional_works
    .filter((a) => a.currency === 'ARS')
    .reduce((sum, a) => sum + a.subtotal_ars, 0);
  const additionalWorksSubtotalUsd = additional_works
    .filter((a) => a.currency === 'USD')
    .reduce((sum, a) => sum + a.subtotal_usd, 0);

  const adtBuckets = bucketAdditionalWorks(additional_works);

  const {
    sections,
    flatMaterials,
    flatPools,
    flatFabrication,
    subtotalMain,
    subtotalGlobal,
  } = buildSections(
    document_type === 'work_order' ? mainMaterials : allMaterials,
    document_type === 'work_order' ? [] : alternatives,
    pools,
    fabricationRows,
    usdRate,
    adtBuckets,
  );

  const mainSection = sections.find((s) => s.is_main);
  const computedSubtotal = (mainSection ? mainSection.subtotal_ars : subtotalMain) + subtotalGlobal;
  const transport = num('transport');
  const transportUsd = num('transport_usd');
  const discountFixedRaw = num('discount_fixed_amount');
  const discountPct = num('discount_percentage');
  const deposit = num('deposit_received');
  const depositUsd = num('deposit_usd');
  const depositCurrency: 'ARS' | 'USD' =
    (str('deposit_currency') || 'ARS').toUpperCase() === 'USD' ? 'USD' : 'ARS';
  // Pass the ARS equivalent of the deposit (deposit_usd * usd_rate when the
  // seña was paid in USD) to computeTotals so balance_due = total - deposit_ars
  // is correct regardless of the deposit's native currency. Mirrors the
  // backend fix in WorkOrderService._recalculate_totals_from_items.
  const depositArsEquivalent =
    depositCurrency === 'USD'
      ? usdRate > 0 ? depositUsd * usdRate : 0
      : deposit;

  const paymentMethodRaw = str('payment_method');
  const paymentMethodIdNum = num('payment_method_id') || null;
  const installmentsNum = num('installments') || 1;
  // Per-order opt-in flag for the DISCOUNT branch. Mirrors the
  // backend `apply_cash_discount` column. When false (default) the
  // DISCOUNT path is skipped entirely so the PDF total equals the
  // subtotal regardless of the selected payment method's discount %.
  const applyCashDiscount = form.apply_cash_discount === true;

  // Resolve the catalogue row for the current method (same lookup as
  // `useBudgetCalculations.resolvePaymentMethod`).
  const pm: PaymentMethod | null = (() => {
    if (paymentMethodIdNum) {
      const byId = paymentMethods.find((p) => p.id === paymentMethodIdNum);
      if (byId) return byId;
    }
    if (paymentMethodRaw) {
      const byName = paymentMethods.find((p) => p.name === paymentMethodRaw);
      if (byName) return byName;
    }
    return null;
  })();

  // Document-level totals — the "representative" total used by the base PDF
  // data (and by a PRINCIPAL page when it exists). Shares the exact same
  // rule set with the per-section totals below via `computeTotals`.
  const globalSection = sections.find((s) => s.is_global);
  const mainSectionSubtotalUsd = mainSection
    ? mainSection.subtotal_usd
    : globalSection
      ? globalSection.subtotal_usd
      : 0;
  const totals = computeTotals({
    subtotalArs: computedSubtotal,
    subtotalUsd: mainSectionSubtotalUsd,
    transport,
    transportUsd,
    discountPct,
    discountFixedRaw,
    usdRate,
    pm,
    installments: installmentsNum,
    deposit: depositArsEquivalent,
    applyCashDiscount,
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
    for (const section of sections) {
      const st = computeTotals({
        subtotalArs: section.subtotal_ars,
        subtotalUsd: section.subtotal_usd,
        transport,
        transportUsd,
        discountPct,
        discountFixedRaw,
        usdRate,
        pm,
        installments: installmentsNum,
        deposit: depositArsEquivalent,
        applyCashDiscount,
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

  // COMPARATIVA DE MEDICIÓN (work orders only). Only emitted when the
  // per-order flag is true (defaults to on). Always computed from the main
  // materials so DocumentPdf can render the table it without further parsing.
  const includeComparison = document_type === 'work_order'
    && (form.include_measurement_comparison_in_pdf !== false);
  const measurement_comparison = includeComparison
    ? buildMeasurementComparison(
        allMaterials,
        usdRate,
        form.fabrication_details,
        form.additional_works_data,
      )
    : [];

  const base: PdfDocumentData = {
    document_type,
    title: document_type === 'budget' ? 'PRESUPUESTO' : 'ORDEN DE TRABAJO',
    number: str('number'),
    doc_sub: STATUS_SUB_MAP[str('status')] || '',
    date: formatDate(form.date),
    client_name: str('client_name'),
    client_phone: str('client_phone'),
    client_address: str('client_address'),
    client_email: str('client_email'),
    material_color: str('color'),
    material_thickness: str('thickness'),
    material_finish: str('finish'),
    delivery_date: formatDate(form.delivery_date),
    sections,
    fabrication_details: flatFabrication,
    materials: flatMaterials,
    pools: flatPools,
    measurement_comparison,
    subtotal: computedSubtotal,
    transport,
    discount_percentage: num('discount_percentage'),
    discount_fixed_amount: discountFixed,
    surcharge_percentage: surchargePct,
    surcharge_amount: surchargeAmount,
    catalogue_surcharge_percentage: catalogueSurchargePct,
    catalogue_surcharge_amount: catalogueSurchargeAmount,
    catalogue_discount_percentage: catalogueDiscountPct,
    catalogue_discount_amount: catalogueDiscountAmount,
    catalogue_method_label: catalogueMethodLabel,
    catalogue_installments: installmentsNum,
    catalogue_installment_detail: catalogueInstallmentDetail,
    deposit_received: deposit,
    deposit_usd: depositUsd,
    deposit_currency: depositCurrency,
    deposit_ars_equivalent: depositArsEquivalent,
    balance_due: computedBalanceDue,
    total: computedTotal,
    total_usd: computedTotalUsd,
    payment_method: str('payment_method'),
    installments: num('installments') || 1,
    notes: str('notes'),
    important_observations: str('important_observations'),
    important_observations_list: splitTerms(form.important_observations),
    budget_terms_list: [],
    delivery_terms_list: overrides?.delivery_terms && overrides.delivery_terms.length > 0
      ? overrides.delivery_terms
      : globalTerms.delivery_terms,
    warranty_terms_list: overrides?.warranty_terms && overrides.warranty_terms.length > 0
      ? overrides.warranty_terms
      : globalTerms.warranty_text,
    sketch_images: sketchImages,
    usd_rate: usdRate,
    usd_rate_fetched_at: str('usd_rate_fetched_at') || null,
    company,
    additional_works,
    additional_works_subtotal_ars: additionalWorksSubtotalArs,
    additional_works_subtotal_usd: additionalWorksSubtotalUsd,
  };

  if (document_type === 'budget') {
    base.budget_terms_list = overrides?.budget_terms && overrides.budget_terms.length > 0
      ? overrides.budget_terms
      : globalTerms.budget_terms;
  }

  return base;
}

export { fmtMoney, fmtNum };
export type {
  DocumentType,
  PdfDataRow,
  MaterialPdfRow,
  PoolPdfRow,
  AdditionalWorkPdfRow,
  MeasurementComparisonRow,
  CompanyInfo,
  TermsInfo,
  PdfDocumentData,
  MaterialSection,
  BuildPdfDataParams,
} from './pdfTypes';
