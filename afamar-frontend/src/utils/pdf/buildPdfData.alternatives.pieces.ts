/**
 * Per-piece / budget-only blocks of the PDF payload.
 *
 * Split out of `buildPdfData.alternatives.ts` (which stays the public
 * barrel) so the "which pieces does the document print" rules live alone:
 *
 *   - `attachPiecesBlocks`       — per-piece layout (budgets AND work orders)
 *   - `attachWinningOptionPieces`— the winning option's pieces drive page 1
 *   - `attachBudgetPiecesData`   — budget terms + consolidated alternatives
 */

import { buildPieces } from './buildPiecesPdfData';
import type { BudgetOption } from '../../types/budget';
import type { BuildAlternativeTotalsParams } from './buildPdfData.types';
import type { PdfDocumentData } from './pdfTypes';
import { buildAlternativeTotals } from './buildPdfData.alternatives.totals';

/**
 * Per-piece block shared by budgets AND work orders: `base.pieces` is the
 * per-piece PDF layout (one PieceBlock per piece) the renderer prefers
 * when `form.pieces` is non-empty — the legacy single-section layout
 * stays in `base.sections` as a fallback for legacy callers / older forms.
 *
 * Always called by `buildPdfData` regardless of document type, so the
 * ORDEN DE TRABAJO gets the same per-piece grouping as the Presupuesto
 * (COCINA / BAÑO / etc. headers instead of a generic "PRINCIPAL" card).
 *
 * MULTI-OPTION BUDGETS (2026-10-01): page 1 must break down the pieces of
 * the WINNING option (the one a conversion turns into a work order), not
 * whichever option the operator happened to have open. The active option
 * is used only as a fallback when no winner is marked.
 */
export function attachPiecesBlocks(
  base: PdfDocumentData,
  form: Record<string, unknown>,
  usdRate: number,
  useBudgetedMeasures = false,
): void {
  const pieces = buildPieces(form, usdRate, useBudgetedMeasures);
  if (pieces.length > 0) {
    base.pieces = pieces;
  }
}

/**
 * Same as {@link attachPiecesBlocks} but for a budget with options: the
 * WINNING option's pieces drive page 1.
 */
export function attachWinningOptionPieces(
  base: PdfDocumentData,
  form: Record<string, unknown>,
  usdRate: number,
): void {
  const options = (form.options ?? []) as BudgetOption[];
  if (options.length === 0) {
    attachPiecesBlocks(base, form, usdRate);
    return;
  }
  const winner =
    options.find((o) => o.is_selected) ??
    options.find((o) => o.id === (form.active_option_id as string)) ??
    options[0];
  const pieces = buildPieces({ pieces: winner.pieces } as Record<string, unknown>, usdRate);
  if (pieces.length > 0) {
    base.pieces = pieces;
  }
}

/**
 * Budget-only block of the document payload: resolves the printed budget
 * terms (override wins over the global terms) and, on multi-piece budgets,
 * attaches the consolidated alternative totals.
 *
 * `sections` is still populated by `buildPdfData` so the totals stay valid
 * and a caller could fall back to the legacy per-option layout.
 */
export function attachBudgetPiecesData(
  base: PdfDocumentData,
  form: Record<string, unknown>,
  usdRate: number,
  opts: {
    budgetTermsOverride?: string[];
    globalBudgetTerms: string[];
    altParams: BuildAlternativeTotalsParams;
  },
): void {
  base.budget_terms_list = opts.budgetTermsOverride && opts.budgetTermsOverride.length > 0
    ? opts.budgetTermsOverride
    : opts.globalBudgetTerms;

  // Consolidated TOTAL GENERAL ALTERNATIVO per material — the same
  // document rule set re-run on the aggregated alternative subtotals
  // (traslado + descuento comercial + recargo + seña) so the HOJA DE
  // ALTERNATIVAS can print the real final price of each alternative
  // material across every piece that quotes it. WO doesn't quote
  // alternatives, so this block is a no-op there.
  if (base.pieces && base.pieces.length > 0) {
    base.alternative_totals = buildAlternativeTotals(base.pieces, opts.altParams);
  }
}
