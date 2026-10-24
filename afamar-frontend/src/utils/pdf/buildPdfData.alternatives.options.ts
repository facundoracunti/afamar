/**
 * Per-OPTION pricing (multi-option budgets).
 *
 * Split out of `buildPdfData.alternatives.ts` (which stays the public
 * barrel) so the "how much is this option worth" rules live alone:
 *
 *   - `computeOptionSubtotal` — subtotal of ONE option (form tabs + PDF)
 *   - `buildOptionTotals`     — per-option totals for the comparativa
 */

import { buildPieces, piecesSubtotal } from './buildPiecesPdfData';
import { computeTotals } from './buildPdfData.totals';
import type { BuildAlternativeTotalsParams } from './buildPdfData.types';
import type { BudgetOption, BudgetPiece } from '../../types/budget';
import type {
  OptionTotal,
  PiecesPdfPiece,
} from './pdfTypes';

/**
 * Subtotal of ONE option, in the document's native buckets.
 *
 * SINGLE SOURCE OF TRUTH for "how much is this option worth": the form's
 * option tabs (what the operator sees while quoting) and the PDF's
 * "Resumen Comparativo de Opciones" (what the customer sees) both call
 * this, so the two can never drift. It prices the option's own pieces —
 * principal material + tramos + zócalo/frente + additional works
 * (traforos) + piletas — exactly like the document's per-piece blocks.
 */
export function computeOptionSubtotal(
  pieces: BudgetPiece[],
  usdRate: number,
): { ars: number; usd: number } {
  const built = buildPieces({ pieces } as Record<string, unknown>, usdRate);
  return piecesSubtotal(built);
}

/**
 * m² of a piece's PRINCIPAL surfaces (the anchor row + its extra panes).
 *
 * The ALTERNATIVES are variants of the SAME surface, so they are NOT
 * counted — otherwise a piece with 3 alternatives would report 4× its
 * real area.
 */
function pieceM2(piece: BudgetPiece): number {
  const rows = [
    ...(piece.mainMaterial ? [piece.mainMaterial] : []),
    ...(piece.mainMaterialRows || []),
  ];
  return rows.reduce(
    (sum, m) =>
      sum +
      Number(m.length || 0) *
      Number(m.width || 0) *
      (Number(m.quantity || 1) || 1),
    0,
  );
}

/** Per-option totals for the "Resumen Comparativo de Opciones" (B1).
 *
 * Each option runs the SAME document rule set as
 * `buildAlternativeTotals` (traslado + descuento comercial + recargo +
 * seña) over ITS OWN subtotal, so the customer compares final prices and
 * not raw sums. Mirrors the backend
 * `budget_option_totals.compute_options_report`, so the PDF and the API
 * never disagree.
 *
 * Only populated when the budget has 2+ options (`isMultiOption`) — a
 * legacy or single-option budget keeps the traditional Hoja de
 * Alternativas, per the B1 decision.
 *
 * ORDER (2026-10-01): the options come back sorted by FINAL PRICE,
 * cheapest FIRST. The comparison page and the per-option detail pages
 * share this array, so the customer sees the same progression in both:
 * the most affordable variant opens the document and the priciest closes
 * it. A tie keeps the original (operator-defined) order.
 */
export function buildOptionTotals(
  options: BudgetOption[],
  pieces: PiecesPdfPiece[],
  usdRate: number,
  params: BuildAlternativeTotalsParams,
): OptionTotal[] {
  if (!options || options.length < 2) return [];
  const rows = options.map((option, index) => {
    const built = buildPieces(
      { pieces: option.pieces } as Record<string, unknown>,
      usdRate,
    );
    const { ars: subtotalArs, usd: subtotalUsd } = piecesSubtotal(built);
    // `buildAlternativeTotals` reuses `computeTotals`, which is the exact
    // rule set the document totals use — same discount base, same recargo.
    const totals = computeTotals({
      subtotalArs,
      subtotalUsd,
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
    // The piletas INCLUDED in this option — printed on its card so the
    // customer knows WHICH bacha each variant comes with.
    const poolModels: string[] = [];
    for (const piece of built) {
      for (const pool of piece.pools || []) {
        const model = `${pool.brand || ''} ${pool.model || ''}`.trim();
        if (model && !poolModels.includes(model)) poolModels.push(model);
      }
    }
    return {
      id: option.id,
      name: option.name,
      is_selected: option.is_selected,
      piece_names: built.map((p) => p.name),
      material_names: built
        .map((p) => p.materials.map((m) => m.name))
        .flat()
        .filter((n, i, arr) => n && arr.indexOf(n) === i),
      pool_models: poolModels,
      // The option's OWN per-piece blocks — the PDF prints one page per
      // option so the customer can evaluate EVERY variant in full detail
      // (piezas, materiales, medidas, traforos y piletas).
      pieces: built,
      total_m2: Math.round(
        (option.pieces || []).reduce((s, p) => s + pieceM2(p), 0) * 100,
      ) / 100,
      piece_count: built.length,
      subtotal_ars: subtotalArs,
      subtotal_usd: subtotalUsd,
      discount_fixed_amount: totals.discount_fixed_amount,
      surcharge_percentage: totals.surcharge_percentage,
      surcharge_amount: totals.surcharge_amount,
      catalogue_installment_detail: totals.catalogue_installment_detail,
      total_ars: totals.total,
      total_usd: totals.total_usd,
      balance_due: totals.balance_due,
      // Sort key: the operator's original position (used to break ties).
      _order: index,
    };
  });

  // Cheapest first. `Array.prototype.sort` is stable, so options with the
  // same price keep the order the operator created them in.
  return rows
    .sort((a, b) => (a.total_ars === b.total_ars ? a._order - b._order : a.total_ars - b.total_ars))
    .map(({ _order, ...row }) => row);
}
