/**
 * PDF data types — PIEZA (multi-piece budget) domain.
 *
 * Extracted from `pdfTypes.ts` (which stays the public barrel). A piece is one
 * mesada/ambiente of a multi-piece budget: its principal breakdown plus
 * every alternative quoted for it.
 */

import type {
  AdditionalWorkPdfRow,
  MaterialPdfRow,
  PdfDataRow,
  PoolPdfRow,
} from './pdfTypes.material';

/**
 * One alternative of a piece, as it appears on the multi-piece PDF's
 * "HOJA DE ALTERNATIVAS" (page 2). Its `subtotal_*` already includes the
 * piece's zócalo/frente + additional works revalued against this
 * alternative's material (same rule as `buildSections`).
 *
 * The variant INHERITS the piece's piletas ("piletas travel with the
 * piece"). The per-variant sink override was removed (2026-10-23): the
 * top-level OPCIONES (tabs) are the only place where a variant is
 * defined, and each option carries its own piletas.
 */
export interface PiecesPdfAlternative {
  title: string;
  material_name: string;
  materials: MaterialPdfRow[];
  fabrication_details: PdfDataRow[];
  additional_works: AdditionalWorkPdfRow[];
  /** Pools rendered for this variant — the piece's own piletas. */
  pools: PoolPdfRow[];
  subtotal_ars: number;
  subtotal_usd: number;
}

/**
 * A single piece (mesada) of a multi-piece budget — its principal
 * breakdown (main material + zócalo/frente + additional works + its own
 * piletas + subtotal) plus every alternative quoted for it. Pools moved
 * out of the document globals and live inside the piece; the alternative
 * subtotals inherit them so swapping materials doesn't lose the sink.
 */
export interface PiecesPdfPiece {
  id: string;
  name: string;
  materials: MaterialPdfRow[];
  fabrication_details: PdfDataRow[];
  additional_works: AdditionalWorkPdfRow[];
  pools: PoolPdfRow[];
  subtotal_ars: number;
  subtotal_usd: number;
  alternatives: PiecesPdfAlternative[];
}

/**
 * Consolidated TOTAL GENERAL ALTERNATIVO for ONE alternative material,
 * aggregated across every piece that quotes it (e.g. "BLANCO NORTE"
 * appearing as Alternativa 1 in Mesada 1 AND Mesada 2 → a single block
 * that covers both).
 *
 * **Composition:** a budget usually quotes alternatives for only ONE
 * sector (e.g. "COCINA / ALZADA / ISLA" → Negro Brasil) while the rest
 * of the job keeps its principal material (e.g. "BAÑO" stays Blanco
 * Suggar). The customer's question is always "cuánto me sale la obra
 * COMPLETA con esta variante?", so the total must include BOTH:
 *   - `alternative_subtotal_*` — the pieces that quote this alternative.
 *   - `fixed_subtotal_*` — the pieces WITHOUT alternatives (common to
 *     every alternative), listed in `fixed_pieces`.
 * The document's total rule set (`computeTotals`: traslado + descuento
 * comercial + recargo + seña) runs over the COMBINED subtotal so the
 * discount / surcharge apply to the real job cost.
 */
export interface PieceAlternativeTotal {
  /** Material name (the alternative grouped by physical material). */
  material_name: string;
  /** Names of the pieces that quote this material as an alternative. */
  pieces: string[];
  // ── Composition (transparent breakdown for the PDF block) ──
  /** Subtotal of the pieces that quote this alternative. */
  alternative_subtotal_ars: number;
  alternative_subtotal_usd: number;
  /** Names of the FIXED pieces (no alternative) added to every variant. */
  fixed_pieces: string[];
  /** Subtotal of the fixed pieces added to every variant. */
  fixed_subtotal_ars: number;
  fixed_subtotal_usd: number;
  // ── Combined job subtotal (alternative + fixed) ──
  /** Currency-agnostic consolidated subtotal (materials + adicionales +
   *  piletas of EVERY piece: the alternative ones + the fixed ones). */
  subtotal_ars: number;
  subtotal_usd: number;
  /** Same rule set as the document-level totals applied to the
   *  consolidated subtotal. */
  discount_fixed_amount: number;
  surcharge_percentage: number;
  surcharge_amount: number;
  catalogue_installment_detail: Array<{ cuota: number; interes: number; monto: number }>;
  total_ars: number;
  total_usd: number;
  balance_due: number;
}
