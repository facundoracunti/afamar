/**
 * ADDITIONAL WORKS of a piece.
 *
 * The piece's `additional_works_data` is a JSON snapshot of the
 * catalogue-driven extra works (traforos, frentes, etc.) the operator
 * attaches to the piece. The whole payload is replaced at once — the
 * editor owns the JSON.
 */
import type { BudgetPiece } from '@/types/budget';

export function mutateSetPieceAdditionalWorks(
  piece: BudgetPiece,
  json: string,
): BudgetPiece {
  return { ...piece, additional_works_data: json };
}
