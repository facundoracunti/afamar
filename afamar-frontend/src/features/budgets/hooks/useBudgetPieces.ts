/**
 * Composable: CRUD for the multi-piece (`pieces_data`) budget flow.
 *
 * Pieces v3 (pieces-only mode, the default everywhere in the app):
 * each piece owns exactly one main material, a list of alternative
 * materials, its own zócalo/frente rows, its own additional works AND
 * its own piletas. The "Alternativa" checkbox on a material cleanly
 * moves the row between the main and alternatives arrays without
 * touching the other one. Piletas previously lived in a global
 * `form.pools_data`; they now live inside the piece they belong to so a
 * "Mesada Cocina" and a "Mesada Baño" can each carry their own sink.
 *
 * Every mutation writes the `pieces` array AND re-flattens it into the
 * legacy document-level arrays (`materials_data`, `fabrication_details`,
 * `additional_works_data`, `pools_data`) in the SAME state update so the
 * rest of the form (totals / card surcharge / cash / backend recalc)
 * keeps reading the flat arrays unchanged.
 *
 * This file is a thin orchestrator: each operation is a one-line
 * `commit` that maps over the pieces, guards on `piece.id`, and hands the
 * matched piece to a pure mutator in `useBudgetPieces.helpers.ts`. The
 * contract (`UseBudgetPiecesParams` / `UseBudgetPiecesReturn`) lives in
 * `useBudgetPieces.types.ts` and is re-exported here so consumers keep
 * importing from this same path.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Material } from '@/types/material';
import type { BudgetPiece, MaterialInForm } from '@/types/budget';
import type { AdditionalWork } from '@/types/additionalWork';
import { getAdditionalWorks } from '@/api/resources/additionalWorks';
import { createEmptyPiece, flattenPieces } from '@features/budgets/utils/pieces';
import {
  mutateAddPieceAlternative,
  mutateAddPieceAlternativeRow,
  mutateAddPieceFabrication,
  mutateAddPieceMainRow,
  mutateRemovePieceAlternative,
  mutateRemovePieceAlternativeRow,
  mutateRemovePieceFabrication,
  mutateRemovePieceMain,
  mutateRemovePieceMainRow,
  mutateRemovePiecePool,
  mutateSetPieceAdditionalWorks,
  mutateSetPieceMain,
  mutateSetPiecePoolFields,
  mutateSwapPieceAlternative,
  mutateSwapPieceMain,
  mutateTogglePieceAlternative,
  mutateUpdatePieceAlternative,
  mutateUpdatePieceAlternativeGroup,
  mutateUpdatePieceFabrication,
  mutateUpdatePieceMain,
  mutateUpdatePieceMainGroup,
  mutateUpdatePieceMainRow,
  mutateUpdatePiecePool,
} from './useBudgetPieces.helpers';
import type { UseBudgetPiecesParams, UseBudgetPiecesReturn } from './useBudgetPieces.types';

export type { UseBudgetPiecesParams, UseBudgetPiecesReturn } from './useBudgetPieces.types';

export function useBudgetPieces({
  form,
  setForm,
  materials,
}: UseBudgetPiecesParams): UseBudgetPiecesReturn {
  const [frontCatalogue, setFrontCatalogue] = useState<AdditionalWork[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getAdditionalWorks();
        if (!cancelled) setFrontCatalogue(data as AdditionalWork[]);
      } catch {
        if (!cancelled) setFrontCatalogue([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const catalogueById = useMemo(
    () => new Map(frontCatalogue.map((c) => [c.id, c])),
    [frontCatalogue],
  );

  const commit = useCallback(
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

  const pieces = form.pieces && form.pieces.length > 0
    ? form.pieces
    : [createEmptyPiece(0)];

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

  // ---------- Main material ----------
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

  // ---------- Alternative materials ----------
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

  // ---------- Piece fabrication rows ----------
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

  // ---------- Piece pools (piletas) ----------
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

  return {
    pieces,
    addPiece,
    removePiece,
    renamePiece,
    setPieceMain,
    updatePieceMain,
    swapPieceMain,
    removePieceMain,
    addPieceMainRow,
    updatePieceMainRow,
    removePieceMainRow,
    updatePieceMainGroup,
    addPieceAlternative,
    addPieceAlternativeRow,
    updatePieceAlternative,
    updatePieceAlternativeGroup,
    swapPieceAlternative,
    removePieceAlternativeRow,
    removePieceAlternative,
    togglePieceAlternative,
    addPieceFabrication,
    updatePieceFabrication,
    removePieceFabrication,
    setPieceAdditionalWorks,
    addPiecePool,
    updatePiecePool,
    removePiecePool,
    setPiecePoolFields,
  };
}