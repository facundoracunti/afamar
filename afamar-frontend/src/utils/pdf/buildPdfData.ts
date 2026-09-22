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
  MaterialSection,
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
  buildAdditionalWorksRows,
  bucketAdditionalWorks,
  asMaterials,
  asPools,
  buildSections,
  buildMeasurementComparison,
} from './buildSectionData';
import { buildPieces, piecesSubtotal } from './buildPiecesPdfData';
import { computeMaterialsSubtotal } from '@features/budgets/utils/commercialDiscount';
import type { PieceAlternativeTotal, PiecesPdfPiece } from './pdfTypes';

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
  /** Fase 3 — Descuento Comercial. `null` keeps the legacy behavior (a
   *  percentage applies whenever `discountPct > 0`); a boolean gates it, so
   *  the toggle OFF means the % never applies. */
  discountEnabled?: boolean | null;
  /** Base for the commercial percentage discount: 'total' = whole document
   *  (materials + fabrication + alternatives + pools + additional), or
   *  'materials' = only the main materials' subtotal. */
  discountTarget?: 'total' | 'materials';
  materialsSubtotalArs?: number;
  materialsSubtotalUsd?: number;
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
  discountEnabled,
  discountTarget,
  materialsSubtotalArs,
  materialsSubtotalUsd,
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
  const catalogueInstallmentDetail: Array<{ cuota: number; interes: number; monto: number }> = [];
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

interface BuildAlternativeTotalsParams {
  transport: number;
  transportUsd: number;
  discountPct: number;
  discountFixedRaw: number;
  usdRate: number;
  pm: PaymentMethod | null;
  installments: number;
  deposit: number;
  discountEnabled?: boolean | null;
  discountTarget?: 'total' | 'materials';
}

/**
 * Consolidate every piece's quoted alternatives into ONE TOTAL GENERAL
 * ALTERNATIVO per material, aggregated across the pieces that quote it.
 * Each piece's contribution is that piece's alternative subtotal (materials
 * + zócalo/frente + additional works + inherited piletas); the whole block
 * re-runs the document's total rule set via `computeTotals` so the customer
 * sees the real final price (traslado + descuento comercial + recargo +
 * seña → saldo) of choosing that material for the whole job.
 *
 * Shown as highlighted summary blocks at the end of the HOJA DE
 * ALTERNATIVAS. Only meaningful on multi-piece budgets (`pieces` non-empty).
 */
export function buildAlternativeTotals(
  pieces: PiecesPdfPiece[],
  params: BuildAlternativeTotalsParams,
): PieceAlternativeTotal[] {
  const byMaterial = new Map<string, { pieces: string[]; subtotalArs: number; subtotalUsd: number }>();
  for (const piece of pieces) {
    for (const alt of piece.alternatives) {
      const key = alt.material_name || alt.title || 'Alternativa';
      const entry = byMaterial.get(key) || { pieces: [], subtotalArs: 0, subtotalUsd: 0 };
      if (!entry.pieces.includes(piece.name || 'Pieza')) entry.pieces.push(piece.name || 'Pieza');
      entry.subtotalArs += alt.subtotal_ars;
      entry.subtotalUsd += alt.subtotal_usd;
      byMaterial.set(key, entry);
    }
  }

  return [...byMaterial.entries()].map(([name, entry]) => {
    const totals = computeTotals({
      subtotalArs: entry.subtotalArs,
      subtotalUsd: entry.subtotalUsd,
      transport: params.transport,
      transportUsd: params.transportUsd,
      discountPct: params.discountPct,
      discountFixedRaw: params.discountFixedRaw,
      usdRate: params.usdRate,
      pm: params.pm,
      installments: params.installments,
      deposit: params.deposit,
      discountEnabled: params.discountEnabled,
      discountTarget: params.discountTarget,
    });
    return {
      material_name: name,
      pieces: entry.pieces,
      subtotal_ars: entry.subtotalArs,
      subtotal_usd: entry.subtotalUsd,
      discount_fixed_amount: totals.discount_fixed_amount,
      surcharge_percentage: totals.surcharge_percentage,
      surcharge_amount: totals.surcharge_amount,
      catalogue_installment_detail: totals.catalogue_installment_detail,
      total_ars: totals.total,
      total_usd: totals.total_usd,
      balance_due: totals.balance_due,
    };
  });
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
    discountEnabled,
    discountTarget,
    materialsSubtotalArs: materialsTotals.materialsSubtotalArs,
    materialsSubtotalUsd: materialsTotals.materialsSubtotalUsd,
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
        discountEnabled,
        discountTarget,
        materialsSubtotalArs: materialsTotals.materialsSubtotalArs,
        materialsSubtotalUsd: materialsTotals.materialsSubtotalUsd,
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
  // pay with. Uppercase `name`s (stable snapshot keys, same convention as
  // the "Forma de pago:" row), ordered by the catalogue `sort_order`. For
  // percentage surcharges (credit card) the surcharge rate is appended
  // (e.g. "TARJETA DE CRÉDITO - 9% P/ CUOTA") so the customer knows how
  // much extra each installment costs before choosing.
  const payment_methods_catalogue = paymentMethods
    .filter((p) => p.is_active !== false)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((p) => {
      if (p.type === 'SURCHARGE' && p.is_percentage && p.applies_to_installments && Number(p.value) > 0) {
        return `${p.name} - ${Number(p.value)}% P/ CUOTA`;
      }
      return p.name;
    });

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
    base.budget_terms_list = overrides?.budget_terms && overrides.budget_terms.length > 0
      ? overrides.budget_terms
      : globalTerms.budget_terms;

    // Multi-piece budgets render a dedicated two-page layout (one block per
    // piece + an alternatives sheet) instead of the legacy per-option
    // sections. `sections` is still populated so the totals above stay
    // valid and a caller could fall back to the legacy layout.
    const pieces = buildPieces(form, usdRate);
    if (pieces.length > 0) {
      base.pieces = pieces;
      // Consolidated TOTAL GENERAL ALTERNATIVO per material — the same
      // document rule set re-run on the aggregated alternative subtotals
      // (traslado + descuento comercial + recargo + seña) so the HOJA DE
      // ALTERNATIVAS can print the real final price of each alternative
      // material across every piece that quotes it.
      base.alternative_totals = buildAlternativeTotals(pieces, {
        transport,
        transportUsd,
        discountPct,
        discountFixedRaw,
        usdRate,
        pm,
        installments: installmentsNum,
        deposit: depositArsEquivalent,
        discountEnabled,
        discountTarget,
      });
    }
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
  PiecesPdfAlternative,
  PiecesPdfPiece,
  PieceAlternativeTotal,
  BuildPdfDataParams,
} from './pdfTypes';
