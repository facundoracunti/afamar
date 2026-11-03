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
  markNew = false,
): BudgetPiece {
  if (!markNew) return { ...piece, additional_works_data: json };
  try {
    const previous = JSON.parse(piece.additional_works_data || '[]');
    const next = JSON.parse(json || '[]');
    if (!Array.isArray(previous) || !Array.isArray(next)) return { ...piece, additional_works_data: json };
    const previousKeys = new Set(
      previous.map((row) => `${row.additional_work_id ?? row.id ?? row.name}|${row.materialName ?? row.material_name ?? ''}`),
    );
    const marked = next.map((row) => {
      const key = `${row.additional_work_id ?? row.id ?? row.name}|${row.materialName ?? row.material_name ?? ''}`;
      return previousKeys.has(key) ? row : { ...row, measurement_origin: 'new' };
    });
    return { ...piece, additional_works_data: JSON.stringify(marked) };
  } catch {
    return { ...piece, additional_works_data: json };
  }
}
