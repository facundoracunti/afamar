/**
 * Handlers of the PRINCIPAL MATERIAL of a piece (pieces-flow,
 * `useBudgetPieces`): pick, edit, swap, remove and the extra
 * measurement rows ("tramos") of the anchor.
 */
import { useCallback } from 'react';
import type { Material } from '@/types/material';
import type { EntityFormState } from '@/types';
import type { MaterialInForm } from '@/types/budget';
import type { AdditionalWork } from '@/types/additionalWork';
import {
  mutateAddPieceMainRow,
  mutateRemovePieceMain,
  mutateRemovePieceMainRow,
  mutateSetPieceMain,
  mutateSwapPieceMain,
  mutateUpdatePieceMain,
  mutateUpdatePieceMainGroup,
  mutateUpdatePieceMainRow,
} from './useBudgetPieces.helpers';
import type { CommitPieces } from './useBudgetPieces.commit';

export interface MainMaterialHandlerDeps {
  commit: CommitPieces;
  form: EntityFormState;
  materials: Material[];
  catalogueById: Map<number, AdditionalWork>;
}

export function useMainMaterialHandlers({
  commit,
  form,
  materials,
  catalogueById,
}: MainMaterialHandlerDeps) {
  const setPieceMain = useCallback(
    (id: string, name: string) => {
      commit((p) =>
        p.map((piece) =>
          piece.id === id ? mutateSetPieceMain(piece, form, materials, name) : piece,
        ),
      );
    },
    [commit, form, materials],
  );

  const updatePieceMain = useCallback(
    (id: string, field: string, value: unknown) => {
      commit((p) =>
        p.map((piece) =>
          piece.id === id ? mutateUpdatePieceMain(piece, field, value, catalogueById) : piece,
        ),
      );
    },
    [commit, catalogueById],
  );

  const swapPieceMain = useCallback(
    (id: string, mat: Material) => {
      commit((p) =>
        p.map((piece) =>
          piece.id === id ? mutateSwapPieceMain(piece, form, mat, catalogueById) : piece,
        ),
      );
    },
    [commit, form, catalogueById],
  );

  const removePieceMain = useCallback(
    (id: string) => {
      commit((p) =>
        p.map((piece) => (piece.id === id ? mutateRemovePieceMain(piece) : piece)),
      );
    },
    [commit],
  );

  const addPieceMainRow = useCallback(
    (id: string, mat: MaterialInForm) => {
      commit((p) =>
        p.map((piece) => (piece.id === id ? mutateAddPieceMainRow(piece, mat) : piece)),
      );
    },
    [commit],
  );

  const updatePieceMainRow = useCallback(
    (id: string, idx: number, field: string, value: unknown) => {
      commit((p) =>
        p.map((piece) =>
          piece.id === id ? mutateUpdatePieceMainRow(piece, idx, field, value) : piece,
        ),
      );
    },
    [commit],
  );

  const removePieceMainRow = useCallback(
    (id: string, idx: number) => {
      commit((p) =>
        p.map((piece) => (piece.id === id ? mutateRemovePieceMainRow(piece, idx) : piece)),
      );
    },
    [commit],
  );

  const updatePieceMainGroup = useCallback(
    (id: string, field: string, value: unknown) => {
      commit((p) =>
        p.map((piece) =>
          piece.id === id
            ? mutateUpdatePieceMainGroup(piece, field, value, catalogueById)
            : piece,
        ),
      );
    },
    [commit, catalogueById],
  );

  return {
    setPieceMain,
    updatePieceMain,
    swapPieceMain,
    removePieceMain,
    addPieceMainRow,
    updatePieceMainRow,
    removePieceMainRow,
    updatePieceMainGroup,
  };
}
