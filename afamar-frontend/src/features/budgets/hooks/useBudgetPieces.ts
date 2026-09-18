import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Material } from '@/types/material';
import type { EntityFormState } from '@/types';
import type {
  BudgetPiece,
  FabricationDetail,
  MaterialInForm,
  PoolInForm,
} from '@/types/budget';
import { getAdditionalWorks } from '@/api/resources/additionalWorks';
import type { AdditionalWork } from '@/types/additionalWork';
import { addMaterialToList, repointSwapReferences } from '@/hooks/entityFormHelpers';
import { recomputeFabricationRow } from '@features/budgets/utils/fabricationDetails';
import { createEmptyPiece, flattenPieces } from '@features/budgets/utils/pieces';

interface UseBudgetPiecesParams {
  form: EntityFormState;
  setForm: React.Dispatch<React.SetStateAction<EntityFormState>>;
  materials: Material[];
}

export interface UseBudgetPiecesReturn {
  /** The form's pieces (always ≥ 1 — pieces-only mode). */
  pieces: BudgetPiece[];
  addPiece: () => void;
  removePiece: (id: string) => void;
  renamePiece: (id: string, name: string) => void;

  // ----- Main material (singular per piece)
  setPieceMain: (id: string, name: string) => void;
  updatePieceMain: (id: string, field: string, value: unknown) => void;
  swapPieceMain: (id: string, mat: Material) => void;
  removePieceMain: (id: string) => void;

  // ----- Alternative materials
  addPieceAlternative: (id: string, name: string) => void;
  addPieceAlternativeRow: (id: string, mat: MaterialInForm) => void;
  updatePieceAlternative: (id: string, idx: number, field: string, value: unknown) => void;
  swapPieceAlternative: (id: string, idx: number, mat: Material) => void;
  removePieceAlternative: (id: string, idx: number) => void;
  togglePieceAlternative: (id: string, idx: number) => void;

  // ----- Piece fabrication (zócalo/frente) rows
  addPieceDetalle: (id: string) => void;
  updatePieceDetalle: (id: string, idx: number, field: string, value: unknown) => void;
  removePieceDetalle: (id: string, idx: number) => void;

  // ----- Piece additional works (JSON snapshot)
  setPieceAdditionalWorks: (id: string, json: string) => void;

  // ----- Piece pools (piletas belong to the piece, not the document)
  addPiecePool: (id: string, poolId: number | string) => void;
  updatePiecePool: (id: string, idx: number, field: string, value: unknown) => void;
  removePiecePool: (id: string, idx: number) => void;
  setPiecePoolFields: (id: string, idx: number, fields: Record<string, unknown>) => void;
}

function pieceMainPrices(piece: BudgetPiece): { ars: number; usd: number } {
  const main = piece.mainMaterial;
  if (!main) return { ars: 0, usd: 0 };
  return { ars: Number(main.price_m2) || 0, usd: Number(main.price_m2_usd) || 0 };
}

/**
 * Capture the dims of the principal material so they can be propagated
 * onto a freshly-picked main AND every alternative. This is the
 * "same mesada, different material" invariant — alternatives mirror
 * the principal's length/width/quantity.
 */
function pieceDims(piece: BudgetPiece): { length: number; width: number; quantity: number } {
  const m = piece.mainMaterial;
  if (m) {
    return {
      length: Number(m.length) || 1,
      width: Number(m.width) || 1,
      quantity: Number(m.quantity) || 1,
    };
  }
  return { length: 1, width: 1, quantity: 1 };
}

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
 */
export function useBudgetPieces({
  form,
  setForm,
  materials,
}: UseBudgetPiecesParams): UseBudgetPiecesReturn {
  const [frenteCatalogue, setFrenteCatalogue] = useState<AdditionalWork[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getAdditionalWorks();
        if (!cancelled) setFrenteCatalogue(data as AdditionalWork[]);
      } catch {
        if (!cancelled) setFrenteCatalogue([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const catalogueById = useMemo(
    () => new Map(frenteCatalogue.map((c) => [c.id, c])),
    [frenteCatalogue],
  );

  const commit = useCallback(
    (mutate: (pieces: BudgetPiece[]) => BudgetPiece[]) => {
      setForm((prev) => {
        const next = mutate(prev.pieces || []);
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
        p.map((piece) => {
          if (piece.id !== id) return piece;
          const seed = piece.mainMaterial ? [piece.mainMaterial] : [];
          const dims = pieceDims(piece);
          const list = addMaterialToList(
            { ...form, materials_data: seed },
            materials,
            name,
          );
          const newMain = list && list.length > 0
            ? { ...list[0], ...dims, is_alternative: false }
            : piece.mainMaterial;
          const alternativeMaterials = piece.alternativeMaterials.map((a) => ({
            ...a,
            ...dims,
          }));
          return { ...piece, mainMaterial: newMain, alternativeMaterials };
        }),
      );
    },
    [commit, form, materials],
  );

  const updatePieceMain = useCallback(
    (id: string, field: string, value: unknown) => {
      commit((p) =>
        p.map((piece) => {
          if (piece.id !== id || !piece.mainMaterial) return piece;
          const mainMaterial = {
            ...piece.mainMaterial,
            [field]: value,
          } as MaterialInForm;
          const isDim = field === 'length' || field === 'width' || field === 'quantity';
          const alternativeMaterials = isDim
            ? piece.alternativeMaterials.map((a) => ({ ...a, [field]: value }))
            : piece.alternativeMaterials;
          return { ...piece, mainMaterial, alternativeMaterials };
        }),
      );
    },
    [commit],
  );

  const swapPieceMain = useCallback(
    (id: string, mat: Material) => {
      commit((p) =>
        p.map((piece) => {
          if (piece.id !== id || !piece.mainMaterial) return piece;
          const oldName = piece.mainMaterial.name;
          const newMain: MaterialInForm = {
            ...piece.mainMaterial,
            id: mat.id ?? null,
            name: mat.name,
            category: '',
            color: mat.color || '',
            price_m2: Number(mat.base_price) || 0,
            price_m2_usd: Number(mat.price_usd) || 0,
            currency: (mat.currency === 'USD' ? 'USD' : 'ARS') as 'ARS' | 'USD',
            is_alternative: false,
          };
          const dims = pieceDims(piece);
          const alternativeMaterials = piece.alternativeMaterials.map((a) => ({
            ...a,
            ...dims,
          }));
          if (oldName === mat.name) return { ...piece, mainMaterial: newMain, alternativeMaterials };
          const synth: EntityFormState = {
            ...form,
            materials_data: [piece.mainMaterial],
            fabrication_details: piece.fabrication_details,
            additional_works_data: piece.additional_works_data,
            pools_data: [],
          };
          const refs = repointSwapReferences(
            synth,
            new Set([oldName].filter(Boolean) as string[]),
            mat.name,
            { mat, catalogueById },
          );
          return {
            ...piece,
            mainMaterial: newMain,
            alternativeMaterials,
            fabrication_details: refs.fabrication_details,
            additional_works_data: refs.additional_works_data ?? '[]',
          };
        }),
      );
    },
    [commit, form, catalogueById],
  );

  const removePieceMain = useCallback(
    (id: string) => {
      commit((p) => p.map((piece) => (piece.id === id ? { ...piece, mainMaterial: null } : piece)));
    },
    [commit],
  );

  // ---------- Alternative materials ----------
  const addPieceAlternative = useCallback(
    (id: string, name: string) => {
      commit((p) =>
        p.map((piece) => {
          if (piece.id !== id) return piece;
          const dims = pieceDims(piece);
          if (!piece.mainMaterial) {
            const list = addMaterialToList(
              { ...form, materials_data: [] },
              materials,
              name,
            );
            return list && list.length > 0
              ? { ...piece, mainMaterial: { ...list[0], ...dims, is_alternative: false } }
              : piece;
          }
          const list = addMaterialToList(
            { ...form, materials_data: piece.alternativeMaterials },
            materials,
            name,
          );
          const next = (list || []).map((m) => ({
            ...m,
            ...dims,
            is_alternative: true,
          }));
          return { ...piece, alternativeMaterials: next };
        }),
      );
    },
    [commit, form, materials],
  );

  const addPieceAlternativeRow = useCallback(
    (id: string, mat: MaterialInForm) => {
      commit((p) =>
        p.map((piece) => {
          if (piece.id !== id) return piece;
          const next = [...piece.alternativeMaterials, { ...mat, is_alternative: true }];
          return { ...piece, alternativeMaterials: next };
        }),
      );
    },
    [commit],
  );

  const updatePieceAlternative = useCallback(
    (id: string, idx: number, field: string, value: unknown) => {
      commit((p) =>
        p.map((piece) => {
          if (piece.id !== id) return piece;
          const list = [...piece.alternativeMaterials];
          if (idx < 0 || idx >= list.length) return piece;
          list[idx] = { ...list[idx], [field]: value } as MaterialInForm;
          return { ...piece, alternativeMaterials: list };
        }),
      );
    },
    [commit],
  );

  const swapPieceAlternative = useCallback(
    (id: string, idx: number, mat: Material) => {
      commit((p) =>
        p.map((piece) => {
          if (piece.id !== id) return piece;
          const list = [...piece.alternativeMaterials];
          if (idx < 0 || idx >= list.length) return piece;
          const old = list[idx];
          const swapped: MaterialInForm = {
            ...old,
            id: mat.id ?? null,
            name: mat.name,
            category: '',
            color: mat.color || '',
            price_m2: Number(mat.base_price) || 0,
            price_m2_usd: Number(mat.price_usd) || 0,
            currency: (mat.currency === 'USD' ? 'USD' : 'ARS') as 'ARS' | 'USD',
            is_alternative: true,
          };
          list[idx] = swapped;
          if (old.name !== mat.name) {
            const synth: EntityFormState = {
              ...form,
              materials_data: [old],
              fabrication_details: piece.fabrication_details,
              additional_works_data: piece.additional_works_data,
              pools_data: [],
            };
            const refs = repointSwapReferences(
              synth,
              new Set([old.name].filter(Boolean) as string[]),
              mat.name,
              { mat, catalogueById },
            );
            return {
              ...piece,
              alternativeMaterials: list,
              fabrication_details: refs.fabrication_details,
              additional_works_data: refs.additional_works_data ?? '[]',
            };
          }
          return { ...piece, alternativeMaterials: list };
        }),
      );
    },
    [commit, form, catalogueById],
  );

  const removePieceAlternative = useCallback(
    (id: string, idx: number) => {
      commit((p) =>
        p.map((piece) => {
          if (piece.id !== id) return piece;
          return {
            ...piece,
            alternativeMaterials: piece.alternativeMaterials.filter((_, i) => i !== idx),
          };
        }),
      );
    },
    [commit],
  );

  const togglePieceAlternative = useCallback(
    (id: string, idx: number) => {
      commit((p) =>
        p.map((piece) => {
          if (piece.id !== id) return piece;
          const alt = piece.alternativeMaterials[idx];
          if (!alt) return piece;
          const previousMain = piece.mainMaterial;
          const newMain: MaterialInForm = { ...alt, is_alternative: false };
          const remainingAlts = piece.alternativeMaterials.filter((_, i) => i !== idx);
          const newAlts = previousMain
            ? [{ ...previousMain, is_alternative: true }, ...remainingAlts]
            : remainingAlts;
          const dims = pieceDims({ ...piece, mainMaterial: newMain });
          const syncedAlts = newAlts.map((a) => ({ ...a, ...dims }));
          return {
            ...piece,
            mainMaterial: newMain,
            alternativeMaterials: syncedAlts,
          };
        }),
      );
    },
    [commit],
  );

  // ---------- Piece fabrication rows ----------
  const addPieceDetalle = useCallback(
    (id: string) => {
      commit((p) =>
        p.map((piece) => {
          if (piece.id !== id) return piece;
          const singleMain = piece.mainMaterial;
          const base: FabricationDetail = {
            concept: 'BASEBOARD',
            detail: '',
            material: singleMain ? singleMain.name || '' : '',
            material_price_m2: singleMain
              ? singleMain.currency === 'USD'
                ? singleMain.price_m2_usd || 0
                : singleMain.price_m2 || 0
              : 0,
            length: null,
            width: null,
            m2: 0,
            labor: null,
            quantity: 1,
            currency: (singleMain?.currency as 'ARS' | 'USD') || 'ARS',
            price: 0,
          };
          return { ...piece, fabrication_details: [...piece.fabrication_details, base] };
        }),
      );
    },
    [commit],
  );

  const updatePieceDetalle = useCallback(
    (id: string, idx: number, field: string, value: unknown) => {
      commit((p) =>
        p.map((piece) => {
          if (piece.id !== id) return piece;
          const { ars, usd } = pieceMainPrices(piece);
          return {
            ...piece,
            fabrication_details: recomputeFabricationRow(
              piece.fabrication_details,
              idx,
              field,
              value,
              { materials, materialPrecio: ars, materialUsd: usd, fallbackMaterialPriceM2: ars },
            ),
          };
        }),
      );
    },
    [commit, materials],
  );

  const removePieceDetalle = useCallback(
    (id: string, idx: number) => {
      commit((p) =>
        p.map((piece) => {
          if (piece.id !== id) return piece;
          return {
            ...piece,
            fabrication_details: piece.fabrication_details.filter((_, i) => i !== idx),
          };
        }),
      );
    },
    [commit],
  );

  const setPieceAdditionalWorks = useCallback(
    (id: string, json: string) => {
      commit((p) =>
        p.map((piece) => (piece.id === id ? { ...piece, additional_works_data: json } : piece)),
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
        p.map((piece) => {
          if (piece.id !== id) return piece;
          const list = [...piece.pools];
          if (idx < 0 || idx >= list.length) return piece;
          list[idx] = { ...list[idx], [field]: value } as PoolInForm;
          return { ...piece, pools: list };
        }),
      );
    },
    [commit],
  );

  const removePiecePool = useCallback(
    (id: string, idx: number) => {
      commit((p) =>
        p.map((piece) => {
          if (piece.id !== id) return piece;
          return {
            ...piece,
            pools: piece.pools.filter((_, i) => i !== idx),
          };
        }),
      );
    },
    [commit],
  );

  const setPiecePoolFields = useCallback(
    (id: string, idx: number, fields: Record<string, unknown>) => {
      commit((p) =>
        p.map((piece) => {
          if (piece.id !== id) return piece;
          const list = [...piece.pools];
          const next = { ...(list[idx] || {}), ...fields } as PoolInForm;
          if (idx >= list.length) list.push(next);
          else list[idx] = next;
          return { ...piece, pools: list };
        }),
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
    addPieceAlternative,
    addPieceAlternativeRow,
    updatePieceAlternative,
    swapPieceAlternative,
    removePieceAlternative,
    togglePieceAlternative,
    addPieceDetalle,
    updatePieceDetalle,
    removePieceDetalle,
    setPieceAdditionalWorks,
    addPiecePool,
    updatePiecePool,
    removePiecePool,
    setPiecePoolFields,
  };
}
