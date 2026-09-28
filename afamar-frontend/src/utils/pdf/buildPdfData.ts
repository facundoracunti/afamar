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
 *
 * The heavy rule sets live in sibling submodules so this file stays a thin,
 * readable orchestrator:
 *  - `buildPdfData.types.ts`       — shared totals / alternatives types
 *  - `buildPdfData.totals.ts`      — `computeTotals` + `applyPerSectionTotals`
 *  - `buildPdfData.helpers.ts`     — paid totals, payment-method resolution,
 *                                    catalogue box, additional-works sums
 *  - `buildPdfData.alternatives.ts`— alternative sections/totals + the
 *                                    budget-only pieces block
 */

import { formatDate, splitTerms } from './pdfHelpers';
import {
  buildFabricationRows,
  buildAdditionalWorksRows,
  bucketAdditionalWorks,
  asMaterials,
  asPools,
  buildSections,
  buildMeasurementComparison,
} from './buildSectionData';
import { buildPieces, piecesSubtotal } from './buildPiecesPdfData';
import { computeMaterialsSubtotal } from '@features/budgets/utils/commercialDiscount';
import { computeTotals, applyPerSectionTotals } from './buildPdfData.totals';
import {
  computeAdditionalWorksSubtotals,
  computePaidTotals,
  computePaymentMethodsCatalogue,
  resolvePaymentMethod,
} from './buildPdfData.helpers';
import { attachBudgetPiecesData } from './buildPdfData.alternatives';
import type {
  DepositCurrency,
  TotalsContext,
} from './buildPdfData.types';
import type { BuildPdfDataParams, PdfDocumentData } from './pdfTypes';

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
  totalPaid,
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
  const {
    ars: additionalWorksSubtotalArs,
    usd: additionalWorksSubtotalUsd,
  } = computeAdditionalWorksSubtotals(additional_works);

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
  // Pieces v2: when the form carries `pieces`, the per-piece PDF is the
  // authoritative layout. The flat `buildSections` path above drops the
  // alternative materials from `mainSection.subtotal_ars` (it keeps them in
  // the alternatives sections), so trusting it would miscalculate the
  // document subtotal the moment the operator marks a material as
  // "Alternativa". The piece principal subtotals already include pools
  // (they moved into the pieces), so they sum to the true document total.
  const piecesEarly = buildPieces(
    (form as unknown) as Record<string, unknown>,
    usdRate,
  );
  const computedSubtotal = piecesEarly.length > 0
    ? piecesSubtotal(piecesEarly).ars
    : (mainSection ? mainSection.subtotal_ars : subtotalMain) + subtotalGlobal;
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
  const globalSection = sections.find((s) => s.is_global);
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

  // COMPARATIVA DE MEDICIÓN (work orders only). Gated ONLY by the per-order
  // flag `include_measurement_comparison_in_pdf` (defaults to OFF since
  // 2026-09-11 — the operator opts in manually via the form checkbox). The
  // toggle is visible on both orders converted from a budget and direct
  // orders; a direct order simply has no "estimated" snapshot, so the
  // Presupuestado column renders "—".
  // Always computed from the main materials so DocumentPdf can render the
  // table it without further parsing.
  const includeComparison = document_type === 'work_order'
    && form.include_measurement_comparison_in_pdf === true;
  const measurement_comparison = includeComparison
    ? buildMeasurementComparison(
        allMaterials,
        usdRate,
        form.fabrication_details,
        form.additional_works_data,
      )
    : [];

  // Active payment methods from the catalogue, printed as a reference box in
  // the PDF ("METODO DE PAGO") so the customer sees every option they can
  // pay with (uppercase `name`s, ordered by `sort_order`; percentage
  // surcharges append their per-cuota rate).
  const payment_methods_catalogue = computePaymentMethodsCatalogue(paymentMethods);

  const base: PdfDocumentData = {
    document_type,
    title: document_type === 'budget' ? 'PRESUPUESTO' : 'ORDEN DE TRABAJO',
    number: str('number'),
    doc_sub: '',
    date: formatDate(form.date),
    client_name: str('client_name'),
    client_phone: str('client_phone'),
    client_address: str('client_address'),
    client_email: str('client_email'),
    material_color: str('color'),
    material_thickness: str('thickness'),
    material_finish: str('finish'),
    delivery_date: form.delivery_date ? formatDate(form.delivery_date) : '',
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
    total_paid_ars: paidArs,
    total_paid_usd: paidUsd,
    paid_label: paidLabel,
    balance_due: computedBalanceDue,
    total: computedTotal,
    total_usd: computedTotalUsd,
    payment_method: str('payment_method'),
    payment_methods_catalogue,
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
    // Budget terms + (multi-piece budgets) the pieces layout with its
    // consolidated TOTAL GENERAL ALTERNATIVO per material.
    attachBudgetPiecesData(base, form, usdRate, {
      budgetTermsOverride: overrides?.budget_terms,
      globalBudgetTerms: globalTerms.budget_terms,
      altParams: {
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
      },
    });
  }

  return base;
}

export { fmtMoney, fmtNum } from './pdfHelpers';
export { computeTotals } from './buildPdfData.totals';
export {
  buildAlternativeSections,
  buildAlternativeTotals,
} from './buildPdfData.alternatives';
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
  PiecesPdfAlternative,
  PiecesPdfPiece,
  PieceAlternativeTotal,
  BuildPdfDataParams,
} from './pdfTypes';