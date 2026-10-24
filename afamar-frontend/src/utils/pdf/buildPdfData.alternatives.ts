/**
 * Alternative-quoting builders for the PDF data payload.
 *
 * `buildAlternativeSections` powers the QUOTE OPTIONS GRID (the form cards,
 * NOT the PDF renderer) — kept separate from `buildPdfData` so the cards and
 * the rendered PDF can never drift on the per-option total.
 *
 * `buildAlternativeTotals` + `attachBudgetPiecesData` power the multi-piece
 * budget's dedicated two-page layout (one block per piece + a HOJA DE
 * ALTERNATIVAS with a consolidated TOTAL GENERAL ALTERNATIVO per material).
 */

import { buildPieces, piecesSubtotal } from './buildPiecesPdfData';
import {
  asMaterials,
  asPools,
  buildAdditionalWorksRows,
  buildFabricationRows,
  bucketAdditionalWorks,
  buildSections,
} from './buildSectionData';
import { computeTotals } from './buildPdfData.totals';
import type { BuildAlternativeTotalsParams } from './buildPdfData.types';
import type { BudgetOption, BudgetPiece } from '../../types/budget';
import type {
  MaterialSection,
  OptionTotal,
  PdfDocumentData,
  PieceAlternativeTotal,
  PiecesPdfPiece,
} from './pdfTypes';

/**
 * Build the per-option `MaterialSection[]` for a budget's ALTERNATIVES,
 * reusing the exact same orchestration as the PDF. Each option section
 * already carries its OWN fully-revalued subtotal (material base + zócalo /
 * frente revalued with that option's material + traforos + pileta) — the
 * ground truth the alternative cards in the form must mirror so they show
 * the same SUBTOTAL the PDF draws.
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

/**
 * Consolidate every piece's quoted alternatives into ONE TOTAL GENERAL
 * ALTERNATIVO per material, aggregated across the pieces that quote it.
 *
 * **Includes the FIXED pieces.** A budget often quotes alternatives for
 * only ONE sector (e.g. "COCINA / ALZADA / ISLA" → Negro Brasil) while
 * the rest of the job keeps its original material (e.g. "BAÑO" stays
 * Blanco Suggar). The customer's question is always "cuánto me sale la
 * obra completa con esta variante?", so the TOTAL GENERAL ALTERNATIVO
 * must add the fixed pieces' subtotals to the alternative ones —
 * otherwise the block quotes a fraction of the job and the customer
 * compares apples to oranges.
 *
 * The block re-runs the document's total rule set via `computeTotals`
 * over the COMBINED subtotal so the discount / recargo / traslado /
 * seña math applies to the real job cost.
 *
 * Composition is exposed per row (`alternative_subtotal_*` vs
 * `fixed_subtotal_*` + `fixed_pieces`) so the renderer can show the
 * breakdown transparently instead of an opaque number.
 *
 * Shown as highlighted summary blocks at the end of the HOJA DE
 * ALTERNATIVAS. Only meaningful on multi-piece budgets (`pieces` non-empty).
 */
export function buildAlternativeTotals(
  pieces: PiecesPdfPiece[],
  params: BuildAlternativeTotalsParams,
): PieceAlternativeTotal[] {
  type Bucket = {
    pieces: string[];
    altSubtotalArs: number;
    altSubtotalUsd: number;
    /** Sink contribution of the variant (material + pool override) — the
     *  `alternative_subtotal_*` minus the material/fabrication part, so the
     *  totals block can show "material + pileta + traforo" per variant. */
  };
  const byMaterial = new Map<string, Bucket>();

  // 1. Fixed baseline — pieces WITHOUT alternatives keep their principal
  //    material, so they're common to EVERY alternative and therefore
  //    part of every alternative's job total. Collected once (not folded
  //    per bucket) so the result is independent of the piece ORDER.
  const fixedAggregates = pieces
    .filter((p) => p.alternatives.length === 0)
    .map((p) => ({
      name: p.name || 'Pieza',
      ars: p.subtotal_ars || 0,
      usd: p.subtotal_usd || 0,
    }))
    .filter((p) => p.ars !== 0 || p.usd !== 0);
  const fixedTotalArs = fixedAggregates.reduce((s, p) => s + p.ars, 0);
  const fixedTotalUsd = fixedAggregates.reduce((s, p) => s + p.usd, 0);
  const fixedPieceNames = fixedAggregates.map((p) => p.name);

  // 2. Alternative contribution — only the pieces that actually quote
  //    this material as an alternative.
  for (const piece of pieces) {
    for (const alt of piece.alternatives) {
      const key = alt.material_name || alt.title || 'Alternativa';
      const bucket = byMaterial.get(key) || {
        pieces: [],
        altSubtotalArs: 0,
        altSubtotalUsd: 0,
      };
      const pieceName = piece.name || 'Pieza';
      if (!bucket.pieces.includes(pieceName)) bucket.pieces.push(pieceName);
      bucket.altSubtotalArs += alt.subtotal_ars || 0;
      bucket.altSubtotalUsd += alt.subtotal_usd || 0;
      byMaterial.set(key, bucket);
    }
  }

  return [...byMaterial.entries()].map(([name, entry]) => {
    const alternativeSubtotalArs = entry.altSubtotalArs;
    const alternativeSubtotalUsd = entry.altSubtotalUsd;
    const fixedSubtotalArs = fixedTotalArs;
    const fixedSubtotalUsd = fixedTotalUsd;
    const combinedArs = alternativeSubtotalArs + fixedSubtotalArs;
    const combinedUsd = alternativeSubtotalUsd + fixedSubtotalUsd;

    const totals = computeTotals({
      subtotalArs: combinedArs,
      subtotalUsd: combinedUsd,
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
      // Composition (transparent breakdown for the PDF block).
      alternative_subtotal_ars: alternativeSubtotalArs,
      alternative_subtotal_usd: alternativeSubtotalUsd,
      fixed_pieces: fixedPieceNames,
      fixed_subtotal_ars: fixedSubtotalArs,
      fixed_subtotal_usd: fixedSubtotalUsd,
      // Combined job subtotal (what the document totals ran on).
      subtotal_ars: combinedArs,
      subtotal_usd: combinedUsd,
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
): void {
  const pieces = buildPieces(form, usdRate);
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