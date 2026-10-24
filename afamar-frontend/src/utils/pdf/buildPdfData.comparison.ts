/**
 * The COMPARATIVA DE MEDICIÓN rows (work orders only).
 *
 * Split out of `buildPdfData.context.ts` so the measurement comparison
 * lives alone, next to the rows and the rule set that surround it.
 */

import {
  buildMeasurementComparison,
  resolveRenderingPieces,
} from './buildSectionData';
import type { DocumentType, MeasurementComparisonRow } from './pdfTypes';

/**
 * COMPARATIVA DE MEDICIÓN (work orders only). Gated ONLY by the per-order
 * flag `include_measurement_comparison_in_pdf` (defaults to OFF since
 * 2026-09-11 — the operator opts in manually via the form checkbox). The
 * toggle is visible on both orders converted from a budget and direct
 * orders; a direct order simply has no "estimated" snapshot, so the
 * Presupuestado column renders "—".
 * Always computed from the main materials so DocumentPdf can render the
 * table it without further parsing.
 */
export function buildDocumentComparison(
  form: Record<string, unknown>,
  effectiveForm: Record<string, unknown>,
  document_type: DocumentType,
  usdRate: number,
): MeasurementComparisonRow[] {
  const includeComparison = document_type === 'work_order'
    && form.include_measurement_comparison_in_pdf === true;
  // Resolve the "rendering pieces" used by the COMPARATIVA. The form
  // may carry `form.pieces` already populated (modern WOs), or only the
  // legacy flat arrays (budget → WO without `pieces_data`, or older
  // API responses). In the latter case, fold the flat arrays into a
  // single piece so the per-piece grouping still has something to
  // render under.
  const renderingPieces = resolveRenderingPieces(effectiveForm);
  return includeComparison
    ? buildMeasurementComparison(renderingPieces, usdRate)
    : [];
}
