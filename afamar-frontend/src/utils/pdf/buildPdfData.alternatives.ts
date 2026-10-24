/**
 * Alternative-quoting builders for the PDF data payload — PUBLIC BARREL.
 *
 * `buildAlternativeSections` powers the QUOTE OPTIONS GRID (the form cards,
 * NOT the PDF renderer) — kept separate from `buildPdfData` so the cards and
 * the rendered PDF can never drift on the per-option total.
 *
 * `buildAlternativeTotals` + `attachBudgetPiecesData` power the multi-piece
 * budget's dedicated two-page layout (one block per piece + a HOJA DE
 * ALTERNATIVAS with a consolidated TOTAL GENERAL ALTERNATIVO per material).
 *
 * The implementations live in focused sub-modules (same folder); this file
 * stays the single import path every consumer already uses:
 *
 *   - `buildPdfData.alternatives.sections` — per-option `MaterialSection[]`
 *   - `buildPdfData.alternatives.totals`   — TOTAL GENERAL ALTERNATIVO per
 *                                           material
 *   - `buildPdfData.alternatives.pieces`   — per-piece / budget blocks
 *   - `buildPdfData.alternatives.options`  — per-option pricing (comparativa)
 */

export { buildAlternativeSections } from './buildPdfData.alternatives.sections';
export { buildAlternativeTotals } from './buildPdfData.alternatives.totals';
export {
  attachBudgetPiecesData,
  attachPiecesBlocks,
  attachWinningOptionPieces,
} from './buildPdfData.alternatives.pieces';
export {
  buildOptionTotals,
  computeOptionSubtotal,
} from './buildPdfData.alternatives.options';
