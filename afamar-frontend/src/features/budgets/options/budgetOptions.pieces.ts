/**
 * ATOMIC writes of the pieces mirror of a multi-option budget.
 *
 * The legacy flat arrays (`materials_data` / `fabrication_details` /
 * `additional_works_data` / `pools_data`) are what the totals
 * (`useBudgetCalculations`), the document-level PDF blocks and the
 * backend recalc read. Mirroring `form.pieces` WITHOUT re-flattening
 * left the flats pointing at the PREVIOUS option, so the operator saw
 * the wrong scenario's amounts in the form while the PDF priced the
 * right one — the two never matched. Every write of `form.pieces` that
 * is not produced by the pieces hook's own `commit` MUST go through
 * `withPieces`.
 */
import type { EntityFormState } from '../../../types/form';
import type { BudgetPiece } from '../../../types/budget';
import { flattenPieces } from '../utils/pieces';

/**
 * Write a pieces array into the form AND re-derive the legacy flat
 * arrays from it.
 */
export function withPieces(
  prev: EntityFormState,
  pieces: BudgetPiece[],
): EntityFormState {
  return { ...prev, pieces, ...flattenPieces(pieces) };
}
