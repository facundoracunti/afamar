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
import type {
  DocumentType,
  PdfDataRow,
  MaterialPdfRow,
  PoolPdfRow,
  AdditionalWorkPdfRow,
  PdfDocumentData,
  BuildPdfDataParams,
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

    const base: AdditionalWorkPdfRow = {
      name,
      detail,
      currency,
      price_str: fmtMoney(price),
      quantity,
      subtotal_ars: currency === 'ARS' ? totalInSourceCurrency : (usdRate > 0 ? totalInSourceCurrency * usdRate : 0),
      subtotal_usd: currency === 'USD' ? totalInSourceCurrency : (usdRate > 0 ? totalInSourceCurrency / usdRate : 0),
      material_name,
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
    if (!bucketKey || bucketKey === POOL_MATERIAL_GLOBAL) {
      adtCommon.push(row);
    } else {
      if (!adtByMaterial[bucketKey]) adtByMaterial[bucketKey] = [];
      adtByMaterial[bucketKey].push(row);
    }
  }
  return { additionalByMaterial: adtByMaterial, additionalCommon: adtCommon };
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
  const discountFixedRaw = num('discount_fixed_amount');
  const discountPct = num('discount_percentage');
  const discountBase = computedSubtotal + transport;
  const discountFixed = discountFixedRaw > 0
    ? discountFixedRaw
    : discountPct > 0
      ? Math.round(discountBase * discountPct) / 100
      : 0;

  const paymentMethodRaw = str('payment_method');
  const paymentMethodIdNum = num('payment_method_id') || null;
  const installmentsNum = num('installments') || 1;

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

  const surchargeBase = Math.max(0, computedSubtotal + transport - discountFixed);
  let computedTotal = surchargeBase;
  let surchargePct = 0;
  let surchargeAmount = 0;
  // Catalogue-driven surcharge / discount (rendered as separate lines
  // in the PDF so the customer can see the breakdown). These mirror
  // what the form hook (`useBudgetCalculations`) and the backend
  // recalc (`_recalculate_totals_from_items`) compute; touching one
  // means touching the others.
  let catalogueSurchargePct = 0;
  let catalogueSurchargeAmount = 0;
  let catalogueDiscountPct = 0;
  let catalogueDiscountAmount = 0;
  let catalogueMethodLabel = '';
  if (pm && pm.type !== 'NONE' && Number(pm.value) > 0) {
    const value = Number(pm.value);
    // Effective multiplier for the *whole* total:
    //   - Credit-card rule (lineal): ratio = 1 + N × value/100
    //   - Flat percentage rule: 1 ± value/100
    let ratio = 1;
    if (pm.applies_to_installments) {
      const n = Math.max(1, installmentsNum);
      ratio = 1 + n * (value / 100);
    } else if (pm.is_percentage) {
      ratio = pm.type === 'DISCOUNT' ? 1 - value / 100 : 1 + value / 100;
    }
    if (ratio !== 1) {
      if (pm.type === 'SURCHARGE') {
        if (pm.is_percentage) {
          // Headline % = recargo total (N × value%). El PDF renderiza
          // "Recargo (X%)" con este valor; el desglose por cuota vive
          // en `catalogue_installment_detail` (todas uniformes).
          // Round a 2dp para evitar ruido de floating point
          // (1.27 → 27.000000000000004).
          const headlinePct = round2((ratio - 1) * 100);
          catalogueSurchargePct = headlinePct;
          surchargePct = headlinePct;
          catalogueSurchargeAmount = Math.round(surchargeBase * (ratio - 1));
          surchargeAmount = catalogueSurchargeAmount;
        } else {
          catalogueSurchargeAmount = value;
          surchargeAmount = value;
        }
        computedTotal = Math.round(surchargeBase * ratio);
      } else if (pm.type === 'DISCOUNT') {
        if (pm.is_percentage) {
          catalogueDiscountPct = round2((1 - ratio) * 100);
          catalogueDiscountAmount = Math.round(surchargeBase * (1 - ratio));
          computedTotal = Math.max(0, Math.round(surchargeBase * ratio));
        } else {
          catalogueDiscountAmount = value;
          computedTotal = Math.max(0, surchargeBase - value);
        }
      }
      catalogueMethodLabel = pm.label || pm.name;
    }
  }
  const deposit = num('deposit_received');
  const computedBalanceDue = Math.max(0, computedTotal - deposit);

  // Per-cuota breakdown (3-column table the PDF renders next to the
  // recargo). Only meaningful for credit-card percentage surcharges
  // with installments >= 1. Mirrors the same calculation in
  // `useBudgetCalculations` and in the backend
  // `_recalculate_totals_from_items`. We compute it here too so the
  // PDF can stand alone when the hook hasn't run yet (e.g. when
  // re-rendering a saved budget that was opened straight to PDF).
  //
  // Recargo lineal: las N cuotas son uniformes. `interes` por cuota
  // = `value` (el % por cuota del catálogo, p.ej. 9). `monto` =
  // `computedTotal / N` (el total con recargo ya incluido, dividido
  // uniforme). La suma de N cuotas = `computedTotal`.
  let catalogueInstallmentDetail: Array<{ cuota: number; interes: number; monto: number }> = [];
  if (
    pm
    && pm.type === 'SURCHARGE'
    && pm.is_percentage
    && pm.applies_to_installments
    && Number(pm.value) > 0
    && installmentsNum >= 1
  ) {
    const value = Number(pm.value);
    const n = Math.max(1, installmentsNum);
    const perCuota = computedTotal > 0 ? round2(computedTotal / n) : 0;
    for (let i = 1; i <= n; i += 1) {
      catalogueInstallmentDetail.push({ cuota: i, interes: value, monto: perCuota });
    }
  }

  // Compute USD total from sections (mirrors the ARS logic above).
  const globalSection = sections.find((s) => s.is_global);
  const mainSectionSubtotalUsd = mainSection
    ? mainSection.subtotal_usd
    : globalSection
      ? globalSection.subtotal_usd
      : 0;
  const transportUsd = num('transport_usd');
  const discountBaseUsd = mainSectionSubtotalUsd + transportUsd;
  const discountFixedUsd = discountPct > 0
    ? Math.round(discountBaseUsd * discountPct) / 100
    : discountFixedRaw > 0 && usdRate > 0
      ? Math.round((discountFixedRaw / usdRate) * 100) / 100
      : 0;
  const surchargeBaseUsd = Math.max(0, mainSectionSubtotalUsd + transportUsd - discountFixedUsd);
  let computedTotalUsd = surchargeBaseUsd;
  if (pm && pm.type !== 'NONE' && Number(pm.value) > 0) {
    const value = Number(pm.value);
    let ratio = 1;
    if (pm.applies_to_installments) {
      const n = Math.max(1, installmentsNum);
      ratio = 1 + n * (value / 100);
    } else if (pm.is_percentage) {
      ratio = pm.type === 'DISCOUNT' ? 1 - value / 100 : 1 + value / 100;
    }
    if (ratio !== 1) {
      if (pm.type === 'SURCHARGE') {
        if (pm.is_percentage) {
          computedTotalUsd = round2(surchargeBaseUsd * ratio);
        } else if (usdRate > 0) {
          computedTotalUsd = round2(surchargeBaseUsd + value / usdRate);
        }
      } else if (pm.type === 'DISCOUNT') {
        if (pm.is_percentage) {
          computedTotalUsd = round2(Math.max(0, surchargeBaseUsd * ratio));
        } else if (usdRate > 0) {
          computedTotalUsd = round2(Math.max(0, surchargeBaseUsd - value / usdRate));
        }
      }
    }
  }
  computedTotalUsd = Math.max(0, computedTotalUsd);

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
  CompanyInfo,
  TermsInfo,
  PdfDocumentData,
  MaterialSection,
  BuildPdfDataParams,
} from './pdfTypes';
