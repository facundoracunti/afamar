/**
 * PDF data types — OPCIÓN (multi-option quote scenario) domain.
 *
 * Extracted from `pdfTypes.ts` (which stays the public barrel). One entry per
 * independent quote scenario of a multi-option budget.
 */

import type { PiecesPdfPiece } from './pdfTypes.piece';

/**
 * Per-option totals for the "Resumen Comparativo de Opciones" (B1,
 * 2026-10-01 Fase 2). One entry per independent quote scenario, each
 * priced with the SAME document rule set (`computeTotals`: traslado +
 * descuento comercial + recargo + seña) over ITS OWN subtotal.
 *
 * Only populated when the budget has 2+ options — a legacy or
 * single-option budget keeps the traditional Hoja de Alternativas.
 */
export interface OptionTotal {
  id: string;
  name: string;
  is_selected: boolean;
  /** Names of the pieces this option covers. */
  piece_names: string[];
  /** Materials quoted across the option's pieces (deduped). */
  material_names: string[];
  /**
   * The piletas (bachas) INCLUDED in this option — brand + model of every
   * sink the option's pieces carry.
   *
   * Printed on the option's card so the customer knows exactly WHICH
   * sink each variant includes ("Pileta: JOHNSON LUXOR COMPACT SI71A").
   */
  pool_models: string[];
  /**
   * The option's OWN per-piece blocks (materials + zócalo/frente +
   * additional works + pools + piece subtotal).
   *
   * The PDF prints one page per option, so the customer can evaluate
   * EVERY variant in full detail — not just a one-line summary.
   */
  pieces: PiecesPdfPiece[];
  /** Total m² of the option's principal surfaces (the quoted area). */
  total_m2: number;
  /** How many pieces / ambientes the option covers. */
  piece_count: number;
  subtotal_ars: number;
  subtotal_usd: number;
  discount_fixed_amount: number;
  surcharge_percentage: number;
  surcharge_amount: number;
  /** Per-cuota breakdown of the recargo (printed on the option's page). */
  catalogue_installment_detail?: Array<{ cuota: number; interes: number; monto: number }>;
  total_ars: number;
  total_usd: number;
  balance_due: number;
}
