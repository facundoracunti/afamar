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

import { buildPieces } from './buildPiecesPdfData';
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
import type {
  MaterialSection,
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
 * Budget-only block of the document payload: resolves the printed budget
 * terms (override wins over the global terms) and, on multi-piece budgets,
 * attaches the pieces + the consolidated alternative totals.
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

  // Multi-piece budgets render a dedicated two-page layout (one block per
  // piece + an alternatives sheet) instead of the legacy per-option
  // sections.
  const pieces = buildPieces(form, usdRate);
  if (pieces.length > 0) {
    base.pieces = pieces;
    // Consolidated TOTAL GENERAL ALTERNATIVO per material — the same
    // document rule set re-run on the aggregated alternative subtotals
    // (traslado + descuento comercial + recargo + seña) so the HOJA DE
    // ALTERNATIVAS can print the real final price of each alternative
    // material across every piece that quotes it.
    base.alternative_totals = buildAlternativeTotals(pieces, opts.altParams);
  }
}