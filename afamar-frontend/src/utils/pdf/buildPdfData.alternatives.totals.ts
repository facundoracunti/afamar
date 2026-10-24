/**
 * Consolidated TOTAL GENERAL ALTERNATIVO per material (budget-only block of
 * the PDF payload).
 *
 * Split out of `buildPdfData.alternatives.ts` (which stays the public
 * barrel) so the "one total per alternative material" rule lives alone.
 */

import { computeTotals } from './buildPdfData.totals';
import type { BuildAlternativeTotalsParams } from './buildPdfData.types';
import type {
  PieceAlternativeTotal,
  PiecesPdfPiece,
} from './pdfTypes';

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
