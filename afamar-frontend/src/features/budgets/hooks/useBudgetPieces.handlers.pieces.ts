/**
 * Handlers of the PIECE list of the pieces-flow (`useBudgetPieces`):
 * adding, removing and renaming the pieces (mesadas) themselves.
 */
import { useCallback } from 'react';
import { createEmptyPiece } from '@features/budgets/utils/pieces';
import type { CommitPieces } from './useBudgetPieces.commit';

export function usePieceHandlers(commit: CommitPieces) {
  const addPiece = useCallback(() => {
    commit((p) => [...p, createEmptyPiece(p.length)]);
  }, [commit]);

  const removePiece = useCallback(
    (id: string) => {
      commit((p) => p.filter((piece) => piece.id !== id));
    },
    [commit],
  );

  const renamePiece = useCallback(
    (id: string, name: string) => {
      commit((p) => p.map((piece) => (piece.id === id ? { ...piece, name } : piece)));
    },
    [commit],
  );

  return { addPiece, removePiece, renamePiece };
}
