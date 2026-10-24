/**
 * PILETAS (sinks) of a piece.
 *
 * Piletas belong to the piece they were quoted for (they no longer live
 * in a document-global `pools_data`), so every pool row is edited
 * through the piece's own `pools` array.
 */
import type { BudgetPiece, PoolInForm } from '@/types/budget';

export function mutateUpdatePiecePool(
  piece: BudgetPiece,
  idx: number,
  field: string,
  value: unknown,
): BudgetPiece {
  const list = [...piece.pools];
  if (idx < 0 || idx >= list.length) return piece;
  list[idx] = { ...list[idx], [field]: value } as PoolInForm;
  return { ...piece, pools: list };
}

export function mutateRemovePiecePool(
  piece: BudgetPiece,
  idx: number,
): BudgetPiece {
  return {
    ...piece,
    pools: piece.pools.filter((_, i) => i !== idx),
  };
}

export function mutateSetPiecePoolFields(
  piece: BudgetPiece,
  idx: number,
  fields: Record<string, unknown>,
): BudgetPiece {
  const list = [...piece.pools];
  const next = { ...(list[idx] || {}), ...fields } as PoolInForm;
  if (idx >= list.length) list.push(next);
  else list[idx] = next;
  return { ...piece, pools: list };
}
