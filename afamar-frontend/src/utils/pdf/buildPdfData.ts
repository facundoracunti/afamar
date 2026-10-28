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
 * This file is the thin ORCHESTRATOR: it resolves the scenario, asks the
 * context builder for the document numbers, hands them to the document
 * builder and attaches the per-piece / per-option blocks. The rule sets
 * live in sibling submodules:
 *  - `buildPdfData.types.ts`       — shared totals / alternatives types
 *  - `buildPdfData.totals.ts`      — `computeTotals` + `applyPerSectionTotals`
 *  - `buildPdfData.helpers.ts`     — paid totals, payment-method resolution,
 *                                    catalogue box, additional-works sums
 *  - `buildPdfData.form.ts`        — form accessors (string / number)
 *  - `buildPdfData.scenario.ts`    — winning option + effective form
 *  - `buildPdfData.context.ts`     — the document numbers (rows + totals)
 *  - `buildPdfData.document.ts`    — the base document object
 *  - `buildPdfData.alternatives.ts`— alternative sections/totals + the
 *                                    budget-only pieces block
 */

import { resolveScenario } from './buildPdfData.scenario';
import { buildDocumentContext } from './buildPdfData.context';
import { buildBaseDocument } from './buildPdfData.document';
import {
  attachBudgetPiecesData,
  attachPiecesBlocks,
  buildOptionTotals,
} from './buildPdfData.alternatives';
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
  usePersistedCommercialTotals = false,
}: BuildPdfDataParams): PdfDocumentData {
  // ── Multi-option budgets (2026-10-01): the document describes the
  // WINNING option ────────────────────────────────────────────────────
  // A budget with 2+ independent options has no single "document content":
  // each option carries its own pieces, materials, traforos and piletas.
  // Page 1 and the document totals must therefore describe the option the
  // conversion would use (the one marked as winner), so the TOTAL at the
  // bottom of the PDF always adds up to the pieces printed above it.
  const { options, effectiveForm } = resolveScenario(form);

  const ctx = buildDocumentContext({
    form,
    effectiveForm,
    document_type,
    paymentMethods,
    totalPaid,
    usePersistedCommercialTotals: usePersistedCommercialTotals && document_type === 'work_order',
  });

  const base = buildBaseDocument(ctx, {
    form,
    document_type,
    overrides,
    company,
    globalTerms,
    sketchImages,
  });

  // Always attach the per-piece blocks (budgets + work orders). When the
  // form carries `pieces`, the renderer prefers the per-piece layout (one
  // PieceBlock per piece — "PIEZA: COCINA" / "PIEZA: BAÑO" headers with
  // their respective materials/fabrications/additional works/pools) over
  // the legacy single-section "PRINCIPAL" card. This unifies the OT and
  // Presupuesto layouts so the operator gets the same per-piece grouping
  // in both document types.
  attachPiecesBlocks(
    base,
    effectiveForm,
    ctx.usdRate,
    usePersistedCommercialTotals && document_type === 'work_order',
  );

  if (document_type === 'budget') {
    // Budget terms + (multi-piece budgets) the consolidated TOTAL GENERAL
    // ALTERNATIVO per material. The alternatives block is budget-only
    // (WO doesn't quote alternatives).
    attachBudgetPiecesData(base, effectiveForm, ctx.usdRate, {
      budgetTermsOverride: overrides?.budget_terms,
      globalBudgetTerms: globalTerms.budget_terms,
      altParams: ctx.altParams,
    });

    // ── Resumen Comparativo de Opciones (B1) ──
    // Populated ONLY when the budget has 2+ independent options. Each
    // option is priced from its OWN pieces with the same document rule
    // set, so the customer compares final prices. A legacy or
    // single-option budget leaves this empty and keeps the traditional
    // Hoja de Alternativas (zero regression on historical documents).
    const optionTotals = buildOptionTotals(
      options as never,
      base.pieces ?? [],
      ctx.usdRate,
      ctx.altParams,
    );
    if (optionTotals.length > 0) base.option_totals = optionTotals;
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
  OptionTotal,
  BuildPdfDataParams,
} from './pdfTypes';
