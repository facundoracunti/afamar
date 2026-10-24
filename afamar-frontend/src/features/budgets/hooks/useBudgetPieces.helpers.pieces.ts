/**
 * PIECE-LEVEL PRIMITIVES of the pieces-flow (`useBudgetPieces`).
 *
 * Small, pure reads of a piece's model that every other mutator module
 * builds upon: the grouping key of an alternative card, the principal
 * material's prices, the "same mesada" dimensions and the set of fields
 * whose edit triggers a re-price of the piece's dependent rows.
 *
 * They live in their own module (instead of the mutator modules) so the
 * mutators can depend on them WITHOUT creating import cycles.
 */
import type { BudgetPiece, MaterialInForm } from '@/types/budget';

/** Stable key that groups rows of the same alternative card together.
 *  Prefers the catalog `id` (numeric, unique) and falls back to `name`
 *  for legacy rows where `id` is null. Two rows that share this key
 *  belong to the same alternative material. */
export function groupKeyOf(alt: MaterialInForm): string {
  return String(alt.id ?? alt.name);
}

export function pieceMainPrices(piece: BudgetPiece): { ars: number; usd: number } {
  const main = piece.mainMaterial;
  if (!main) return { ars: 0, usd: 0 };
  return { ars: Number(main.price_m2) || 0, usd: Number(main.price_m2_usd) || 0 };
}

/**
 * Capture the dims of the principal material so they can be propagated
 * onto a freshly-picked main AND every alternative. This is the
 * "same mesada, different material" invariant — alternatives mirror
 * the principal's length/width/quantity.
 *
 * Length/width default to 0 (not 1): a material added without real
 * measurements must NOT count as 1 m² against the subtotal — the
 * operator types the real dims. Only `quantity` keeps a neutral 1.
 */
export function pieceDims(piece: BudgetPiece): { length: number; width: number; quantity: number } {
  const m = piece.mainMaterial;
  if (m) {
    return {
      length: Number(m.length) || 0,
      width: Number(m.width) || 0,
      quantity: Number(m.quantity) || 1,
    };
  }
  return { length: 0, width: 0, quantity: 1 };
}

/** Fields on a material whose edit changes the $/m² the frente formula
 *  derives from. Editing any of these must re-price the piece's `frente`
 *  additional works (see `refreshPieceFrentes`) or the snapshot stays at
 *  the previous material's price. */
export const FRENTE_PRICE_FIELDS: ReadonlySet<string> = new Set([
  'price_m2',
  'price_m2_usd',
  'currency',
]);
