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
import { INSTALLMENT_SURCHARGE_PERCENTAGE, PAYMENT_METHOD_CREDIT_CARD } from '../../constants';
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
        ? `${linearMeters.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ml`
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
  const installmentsNum = num('installments') || 1;
  const surchargePct = paymentMethodRaw === PAYMENT_METHOD_CREDIT_CARD
    ? (INSTALLMENT_SURCHARGE_PERCENTAGE[installmentsNum] || 0)
    : 0;
  const surchargeBase = Math.max(0, computedSubtotal + transport - discountFixed);
  const surchargeAmount = surchargePct > 0
    ? Math.round(surchargeBase * surchargePct) / 100
    : 0;
  const deposit = num('deposit_received');
  const computedTotal = Math.max(0, surchargeBase + surchargeAmount);
  const computedBalanceDue = Math.max(0, computedTotal - deposit);

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
    deposit_received: deposit,
    balance_due: computedBalanceDue,
    total: computedTotal,
    total_usd: num('total_usd'),
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
