/**
 * Handlers of the piece's own WORK ROWS (pieces-flow, `useBudgetPieces`):
 * the manual zócalo / frente rows (`fabrication_details`) and the
 * catalogue-driven additional works (`additional_works_data`).
 */
import { useCallback } from 'react';
import type { Material } from '@/types/material';
import {
  mutateAddPieceFabrication,
  mutateRemovePieceFabrication,
  mutateSetPieceAdditionalWorks,
  mutateUpdatePieceFabrication,
} from './useBudgetPieces.helpers';
import type { CommitPieces } from './useBudgetPieces.commit';

export interface WorksHandlerDeps {
  commit: CommitPieces;
  materials: Material[];
}

export function useWorksHandlers({ commit, materials }: WorksHandlerDeps) {
  const addPieceFabrication = useCallback(
    (id: string) => {
      commit((p) =>
        p.map((piece) => (piece.id === id ? mutateAddPieceFabrication(piece) : piece)),
      );
    },
    [commit],
  );

  const updatePieceFabrication = useCallback(
    (id: string, idx: number, field: string, value: unknown) => {
      commit((p) =>
        p.map((piece) =>
          piece.id === id
            ? mutateUpdatePieceFabrication(piece, idx, field, value, materials)
            : piece,
        ),
      );
    },
    [commit, materials],
  );

  const removePieceFabrication = useCallback(
    (id: string, idx: number) => {
      commit((p) =>
        p.map((piece) => (piece.id === id ? mutateRemovePieceFabrication(piece, idx) : piece)),
      );
    },
    [commit],
  );

  const setPieceAdditionalWorks = useCallback(
    (id: string, json: string) => {
      commit((p) =>
        p.map((piece) => (piece.id === id ? mutateSetPieceAdditionalWorks(piece, json) : piece)),
      );
    },
    [commit],
  );

  return {
    addPieceFabrication,
    updatePieceFabrication,
    removePieceFabrication,
    setPieceAdditionalWorks,
  };
}
