/**
 * Handlers of the PILETAS (sinks) of a piece (pieces-flow,
 * `useBudgetPieces`).
 *
 * Piletas belong to the piece they were quoted for — they no longer live
 * in a document-global `pools_data`.
 */
import { useCallback } from 'react';
import {
  mutateRemovePiecePool,
  mutateSetPiecePoolFields,
  mutateUpdatePiecePool,
} from './useBudgetPieces.helpers';
import type { CommitPieces } from './useBudgetPieces.commit';

export function usePoolHandlers(commit: CommitPieces) {
  const addPiecePool = useCallback(
    (_id: string, _poolId: number | string) => {
      // The piece pool picker builds a fully-formed PoolInForm via
      // `setPiecePoolFields` (append mode), so this is a no-op reserved
      // for API symmetry with the document-global pool picker.
    },
    [],
  );

  const updatePiecePool = useCallback(
    (id: string, idx: number, field: string, value: unknown) => {
      commit((p) =>
        p.map((piece) => (piece.id === id ? mutateUpdatePiecePool(piece, idx, field, value) : piece)),
      );
    },
    [commit],
  );

  const removePiecePool = useCallback(
    (id: string, idx: number) => {
      commit((p) =>
        p.map((piece) => (piece.id === id ? mutateRemovePiecePool(piece, idx) : piece)),
      );
    },
    [commit],
  );

  const setPiecePoolFields = useCallback(
    (id: string, idx: number, fields: Record<string, unknown>) => {
      commit((p) =>
        p.map((piece) =>
          piece.id === id ? mutateSetPiecePoolFields(piece, idx, fields) : piece,
        ),
      );
    },
    [commit],
  );

  return { addPiecePool, updatePiecePool, removePiecePool, setPiecePoolFields };
}
