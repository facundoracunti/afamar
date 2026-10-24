/**
 * Handlers of the ALTERNATIVE MATERIALS of a piece (pieces-flow,
 * `useBudgetPieces`).
 *
 * An alternative is a variant of the piece quoted with a different
 * material but the same mesada. Every alternative is a GROUP of panes
 * sharing the same material identity (`groupKey`).
 */
import { useCallback } from 'react';
import type { Material } from '@/types/material';
import type { EntityFormState } from '@/types';
import type { MaterialInForm } from '@/types/budget';
import type { AdditionalWork } from '@/types/additionalWork';
import {
  mutateAddPieceAlternative,
  mutateAddPieceAlternativeRow,
  mutateRemovePieceAlternative,
  mutateRemovePieceAlternativeRow,
  mutateSwapPieceAlternative,
  mutateTogglePieceAlternative,
  mutateUpdatePieceAlternative,
  mutateUpdatePieceAlternativeGroup,
} from './useBudgetPieces.helpers';
import type { CommitPieces } from './useBudgetPieces.commit';

export interface AlternativeMaterialHandlerDeps {
  commit: CommitPieces;
  form: EntityFormState;
  materials: Material[];
  catalogueById: Map<number, AdditionalWork>;
}

export function useAlternativeMaterialHandlers({
  commit,
  form,
  materials,
  catalogueById,
}: AlternativeMaterialHandlerDeps) {
  const addPieceAlternative = useCallback(
    (id: string, name: string) => {
      commit((p) =>
        p.map((piece) =>
          piece.id === id ? mutateAddPieceAlternative(piece, form, materials, name) : piece,
        ),
      );
    },
    [commit, form, materials],
  );

  const addPieceAlternativeRow = useCallback(
    (id: string, groupKey: string, mat: MaterialInForm) => {
      commit((p) =>
        p.map((piece) =>
          piece.id === id ? mutateAddPieceAlternativeRow(piece, groupKey, mat) : piece,
        ),
      );
    },
    [commit],
  );

  const updatePieceAlternative = useCallback(
    (id: string, groupKey: string, rowIdx: number, field: string, value: unknown) => {
      commit((p) =>
        p.map((piece) =>
          piece.id === id
            ? mutateUpdatePieceAlternative(piece, groupKey, rowIdx, field, value, catalogueById)
            : piece,
        ),
      );
    },
    [commit, catalogueById],
  );

  const updatePieceAlternativeGroup = useCallback(
    (id: string, groupKey: string, field: string, value: unknown) => {
      commit((p) =>
        p.map((piece) =>
          piece.id === id
            ? mutateUpdatePieceAlternativeGroup(piece, groupKey, field, value, catalogueById)
            : piece,
        ),
      );
    },
    [commit, catalogueById],
  );

  const swapPieceAlternative = useCallback(
    (id: string, groupKey: string, mat: Material) => {
      commit((p) =>
        p.map((piece) =>
          piece.id === id
            ? mutateSwapPieceAlternative(piece, form, groupKey, mat, catalogueById)
            : piece,
        ),
      );
    },
    [commit, form, catalogueById],
  );

  const removePieceAlternativeRow = useCallback(
    (id: string, groupKey: string, rowIdx: number) => {
      commit((p) =>
        p.map((piece) =>
          piece.id === id ? mutateRemovePieceAlternativeRow(piece, groupKey, rowIdx) : piece,
        ),
      );
    },
    [commit],
  );

  const removePieceAlternative = useCallback(
    (id: string, groupKey: string) => {
      commit((p) =>
        p.map((piece) =>
          piece.id === id ? mutateRemovePieceAlternative(piece, groupKey) : piece,
        ),
      );
    },
    [commit],
  );

  const togglePieceAlternative = useCallback(
    (id: string, groupKey: string) => {
      commit((p) =>
        p.map((piece) =>
          piece.id === id
            ? mutateTogglePieceAlternative(piece, groupKey, catalogueById)
            : piece,
        ),
      );
    },
    [commit, catalogueById],
  );

  return {
    addPieceAlternative,
    addPieceAlternativeRow,
    updatePieceAlternative,
    updatePieceAlternativeGroup,
    swapPieceAlternative,
    removePieceAlternativeRow,
    removePieceAlternative,
    togglePieceAlternative,
  };
}
