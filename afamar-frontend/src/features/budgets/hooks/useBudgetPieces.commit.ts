/**
 * The ATOMIC commit of the pieces-flow (`useBudgetPieces`).
 *
 * Every mutation of the pieces array goes through `usePiecesCommit`:
 * it writes the new pieces AND re-derives the legacy document-level
 * arrays (`materials_data`, `fabrication_details`,
 * `additional_works_data`, `pools_data`) in the SAME state update, so
 * the rest of the form (totals / card surcharge / cash / backend
 * recalc) keeps reading the flat arrays unchanged.
 */
import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { EntityFormState } from '@/types';
import type { BudgetPiece } from '@/types/budget';
import { createEmptyPiece, flattenPieces } from '@features/budgets/utils/pieces';

/** Applies ONE pure mutation over the pieces and persists the result. */
export type CommitPieces = (mutate: (pieces: BudgetPiece[]) => BudgetPiece[]) => void;

export function usePiecesCommit(
  setForm: Dispatch<SetStateAction<EntityFormState>>,
): CommitPieces {
  return useCallback(
    (mutate: (pieces: BudgetPiece[]) => BudgetPiece[]) => {
      setForm((prev) => {
        let next = mutate(prev.pieces || []);
        // Pieces v3 invariant: the form ALWAYS carries ≥ 1 piece. If a
        // mutation would empty the array (e.g. `removePiece` on the last
        // one), collapse to a single fresh empty piece PERSISTED in state —
        // a render-time fallback (`pieces = form.pieces || [createEmptyPiece(0)]`)
        // would regenerate its id on EVERY render, remount the card (its
        // `key={piece.id}` changes), and refetch the adicionales catalogue
        // (the "Cargando catálogo..." flicker) while silently dropping
        // renames typed into the ghost (they mapped over `[]`).
        if (next.length === 0) next = [createEmptyPiece(0)];
        return { ...prev, pieces: next, ...flattenPieces(next) };
      });
    },
    [setForm],
  );
}
