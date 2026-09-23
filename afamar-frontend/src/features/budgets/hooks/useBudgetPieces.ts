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
import type { AdditionalWorkSelection } from '@/utils/additionalWorkParse';
import { parseAdditionalWorksData, serializeAdditionalWorksData } from '@/utils/additionalWorkParse';
import {
  buildFrenteMaterialOptions,
  computeFrenteTotal,
  resolveFrenteMultiplier,
} from '@/utils/frentePricing';
import { POOL_MATERIAL_GLOBAL } from '@/types/budget';

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

  // ----- Main material (singular anchor + extra measurement rows)
  setPieceMain: (id: string, name: string) => void;
  updatePieceMain: (id: string, field: string, value: unknown) => void;
  swapPieceMain: (id: string, mat: Material) => void;
  removePieceMain: (id: string) => void;
  /** Add another measurement row ("tramo") of the same principal material.
   *  The passed row is used as the identity seed (name/prices/currency);
   *  the new row starts with blank dims, like the legacy addRow. */
  addPieceMainRow: (id: string, mat: MaterialInForm) => void;
  /** Update ONE main row by its position inside `[main, ...mainMaterialRows]`
   *  (idx 0 = the anchor, idx ≥ 1 = a tramo). */
  updatePieceMainRow: (id: string, idx: number, field: string, value: unknown) => void;
  /** Remove ONE main row by its position inside `[main, ...mainMaterialRows]`.
   *  Removing idx 0 (the anchor) when tramos exist promotes the first tramo
   *  to anchor so the piece never ends up with rows but no main. */
  removePieceMainRow: (id: string, idx: number) => void;
  /** Apply `field` to EVERY main row (anchor + tramos) — used by the card's
   *  shared price input so one edit prices the whole physical material. */
  updatePieceMainGroup: (id: string, field: string, value: unknown) => void;

  // ----- Alternative materials (grouped by material identity; one card
  // per material, with N panes/tramos inside).
  addPieceAlternative: (id: string, name: string) => void;
  /** Append a NEW pane (length/width/quantity blank) to the group with
   *  `groupKey` (= the alternative's id or name). Strictly LOCAL — does
   *  NOT touch the principal nor the other alternatives. */
  addPieceAlternativeRow: (id: string, groupKey: string, mat: MaterialInForm) => void;
  updatePieceAlternative: (id: string, groupKey: string, rowIdx: number, field: string, value: unknown) => void;
  /** Apply `field` to EVERY pane inside the same alternative card
   *  (shared price input). */
  updatePieceAlternativeGroup: (id: string, groupKey: string, field: string, value: unknown) => void;
  swapPieceAlternative: (id: string, groupKey: string, mat: Material) => void;
  /** Remove the WHOLE alternative card (all panes with the same
   *  groupKey). Use `removePieceAlternativeRow` for a single pane. */
  removePieceAlternative: (id: string, groupKey: string) => void;
  removePieceAlternativeRow: (id: string, groupKey: string, rowIdx: number) => void;
  togglePieceAlternative: (id: string, groupKey: string) => void;

  // ----- Piece fabrication (zócalo/frente) rows
  addPieceFabrication: (id: string) => void;
  updatePieceFabrication: (id: string, idx: number, field: string, value: unknown) => void;
  removePieceFabrication: (id: string, idx: number) => void;

  // ----- Piece additional works (JSON snapshot)
  setPieceAdditionalWorks: (id: string, json: string) => void;

  // ----- Piece pools (piletas belong to the piece, not the document)
  addPiecePool: (id: string, poolId: number | string) => void;
  updatePiecePool: (id: string, idx: number, field: string, value: unknown) => void;
  removePiecePool: (id: string, idx: number) => void;
  setPiecePoolFields: (id: string, idx: number, fields: Record<string, unknown>) => void;
}

/** Stable key that groups rows of the same alternative card together.
 *  Prefers the catalog `id` (numeric, unique) and falls back to `name`
 *  for legacy rows where `id` is null. Two rows that share this key
 *  belong to the same alternative material. */
function groupKeyOf(alt: MaterialInForm): string {
  return String(alt.id ?? alt.name);
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
 *
 * Length/width default to 0 (not 1): a material added without real
 * measurements must NOT count as 1 m² against the subtotal — the
 * operator types the real dims. Only `quantity` keeps a neutral 1.
 */
function pieceDims(piece: BudgetPiece): { length: number; width: number; quantity: number } {
  const m = piece.mainMaterial;
  if (m) {
    return {
      length: Number(m.length) || 0,
      width: Number(m.width) || 0,
      quantity: Number(m.quantity) || 1,
    };
  }
  return { length: 0, width: 0, quantity: 1 };
}

/** Fields on a material whose edit changes the $/m² the frente formula
 *  derives from. Editing any of these must re-price the piece's `frente`
 *  additional works (see `refreshPieceFrentes`) or the snapshot stays at
 *  the previous material's price. */
const FRENTE_PRICE_FIELDS: ReadonlySet<string> = new Set([
  'price_m2',
  'price_m2_usd',
  'currency',
]);

/**
 * Dynamic refresh of a piece's `frente` additional works after a material
 * identity/price change on the SAME piece (principal pick, price/currency
 * edit, swap to another material). Every frente row that resolves to a
 * material is re-priced against that material's CURRENT $/m² and currency.
 *
 * Resolution: by `assigned_material_id` first (catalogue id), falling back
 * to the unprefixed `materialName` for legacy rows whose id was not
 * captured. Rows that resolve to NO material (GLOBAL, or assigned to a
 * material that no longer exists on the piece) are left untouched — never
 * zeroed (unlike `recomputeFrenteRow`, which would null the price when the
 * id is null). Returns the same piece reference when nothing changed so the
 * downstream `commit` doesn't write a no-op JSON.
 */
function refreshPieceFrentes(
  piece: BudgetPiece,
  catalogueById: Map<number, AdditionalWork>,
): BudgetPiece {
  const rows = parseAdditionalWorksData(piece.additional_works_data);
  if (rows.length === 0) return piece;

  const pieceMaterials: MaterialInForm[] = [
    piece.mainMaterial,
    ...(piece.mainMaterialRows || []),
    ...(piece.alternativeMaterials || []),
  ].filter(Boolean) as MaterialInForm[];
  const materialOptions = buildFrenteMaterialOptions({ materials: pieceMaterials });
  if (materialOptions.length === 0) return piece;

  const unprefix = (name: string) =>
    name.startsWith('__ALT__:') ? name.slice('__ALT__:'.length) : name;

  let changed = false;
  const nextRows = rows.map((row) => {
    if (row.type !== 'frente') return row;
    const isGlobal =
      row.materialName === POOL_MATERIAL_GLOBAL && row.assigned_material_id == null;
    if (isGlobal) return row;
    const byId =
      row.assigned_material_id != null
        ? materialOptions.find((m) => m.id === row.assigned_material_id)
        : undefined;
    const byName =
      !byId && row.materialName
        ? materialOptions.find((m) => m.name === unprefix(row.materialName as string))
        : undefined;
    const opt = byId ?? byName;
    // Unresolvable — keep the row verbatim rather than zeroing it.
    if (!opt) return row;

    const catalogueItem = catalogueById.get(Number(row.additional_work_id));
    const multiplier = resolveFrenteMultiplier(catalogueItem);
    const computed = computeFrenteTotal(
      opt.price_per_m2,
      multiplier,
      Number(row.linear_meters || 0),
    );

    const updated: AdditionalWorkSelection = {
      ...row,
      price: computed.price_per_meter,
      total: computed.total,
      currency: opt.currency,
      materialName: opt.is_alternative ? `__ALT__:${opt.name}` : opt.name,
      assigned_material_id: opt.id,
      formula_values: {
        material_price_m2_at_selection: opt.price_per_m2,
        multiplier,
        computed_at: new Date().toISOString(),
      },
    };
    // Only adopt the recomputation when something actually moved — avoid
    // churning `computed_at` (and the JSON) on every unrelated commit.
    if (
      updated.price === row.price &&
      updated.total === row.total &&
      updated.currency === row.currency &&
      updated.assigned_material_id === row.assigned_material_id &&
      updated.materialName === row.materialName
    ) {
      return row;
    }
    changed = true;
    return updated;
  });

  if (!changed) return piece;
  return { ...piece, additional_works_data: serializeAdditionalWorksData(nextRows) };
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
          const base = { ...piece, mainMaterial, alternativeMaterials };
          // $/m² or currency edit → re-price the piece's frentes against the
          // new price (see `refreshPieceFrentes`).
          return FRENTE_PRICE_FIELDS.has(field)
            ? refreshPieceFrentes(base, catalogueById)
            : base;
        }),
      );
    },
    [commit, catalogueById],
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
          // Tramos are panes of the same physical material — re-identify
          // them too (name/color/prices/currency) but keep each row's dims.
          const mainMaterialRows = (piece.mainMaterialRows || []).map((row) => ({
            ...row,
            id: mat.id ?? null,
            name: mat.name,
            category: '',
            color: mat.color || '',
            price_m2: Number(mat.base_price) || 0,
            price_m2_usd: Number(mat.price_usd) || 0,
            currency: (mat.currency === 'USD' ? 'USD' : 'ARS') as 'ARS' | 'USD',
            is_alternative: false,
          }));
          const dims = pieceDims(piece);
          const alternativeMaterials = piece.alternativeMaterials.map((a) => ({
            ...a,
            ...dims,
          }));
          if (oldName === mat.name) {
            return { ...piece, mainMaterial: newMain, mainMaterialRows, alternativeMaterials };
          }
          const synth: EntityFormState = {
            ...form,
            materials_data: [piece.mainMaterial, ...mainMaterialRows],
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
          const base: BudgetPiece = {
            ...piece,
            mainMaterial: newMain,
            mainMaterialRows,
            alternativeMaterials,
            fabrication_details: refs.fabrication_details,
            additional_works_data: refs.additional_works_data ?? '[]',
          };
          // Safety net: re-price frentes that are assigned by catalogue id
          // (their `materialName` may not equal `oldName`, so the
          // name-based repoint above left them at the old material price).
          return refreshPieceFrentes(base, catalogueById);
        }),
      );
    },
    [commit, form, catalogueById],
  );

  const removePieceMain = useCallback(
    (id: string) => {
      commit((p) =>
        p.map((piece) =>
          piece.id === id
            ? { ...piece, mainMaterial: null, mainMaterialRows: [] }
            : piece,
        ),
      );
    },
    [commit],
  );

  const addPieceMainRow = useCallback(
    (id: string, mat: MaterialInForm) => {
      commit((p) =>
        p.map((piece) => {
          if (piece.id !== id || !piece.mainMaterial) return piece;
          const seed = piece.mainMaterial;
          const tramo: MaterialInForm = {
            ...(mat && mat.name ? mat : seed),
            quantity: 1,
            m2_used: 0,
            m2_budgeted: 0,
            length: 0,
            width: 0,
            is_alternative: false,
          };
          // Strictly LOCAL — does NOT mirror the new pane into the
          // alternatives. Each alternative owns its own rows.
          return {
            ...piece,
            mainMaterialRows: [...(piece.mainMaterialRows || []), tramo],
          };
        }),
      );
    },
    [commit],
  );

  const updatePieceMainRow = useCallback(
    (id: string, idx: number, field: string, value: unknown) => {
      commit((p) =>
        p.map((piece) => {
          if (piece.id !== id) return piece;
          const rows = piece.mainMaterialRows || [];
          // idx 0 = the anchor (`mainMaterial`), idx ≥ 1 = a tramo.
          if (idx === 0) {
            if (!piece.mainMaterial) return piece;
            return {
              ...piece,
              mainMaterial: { ...piece.mainMaterial, [field]: value } as MaterialInForm,
            };
          }
          const list = [...rows];
          if (idx - 1 < 0 || idx - 1 >= list.length) return piece;
          list[idx - 1] = { ...list[idx - 1], [field]: value } as MaterialInForm;
          return { ...piece, mainMaterialRows: list };
        }),
      );
    },
    [commit],
  );

  const removePieceMainRow = useCallback(
    (id: string, idx: number) => {
      commit((p) =>
        p.map((piece) => {
          if (piece.id !== id) return piece;
          const rows = piece.mainMaterialRows || [];
          let nextMain: MaterialInForm | null = piece.mainMaterial;
          let nextRows: MaterialInForm[] = rows;
          if (idx === 0) {
            // Removing the anchor: promote the first tramo so the piece
            // never ends with rows but no main.
            if (rows.length === 0) {
              nextMain = null;
            } else {
              nextMain = { ...rows[0], is_alternative: false };
              nextRows = rows.slice(1);
            }
          } else {
            nextRows = rows.filter((_, i) => i !== idx - 1);
          }
          // Strictly LOCAL — alternatives keep their own rows even
          // when the principal loses a pane.
          return {
            ...piece,
            mainMaterial: nextMain,
            mainMaterialRows: nextRows,
          };
        }),
      );
    },
    [commit],
  );

  const updatePieceMainGroup = useCallback(
    (id: string, field: string, value: unknown) => {
      commit((p) =>
        p.map((piece) => {
          if (piece.id !== id || !piece.mainMaterial) return piece;
          const base = {
            ...piece,
            mainMaterial: { ...piece.mainMaterial, [field]: value } as MaterialInForm,
            mainMaterialRows: (piece.mainMaterialRows || []).map((row) => ({
              ...row,
              [field]: value,
            })),
          };
          return FRENTE_PRICE_FIELDS.has(field)
            ? refreshPieceFrentes(base, catalogueById)
            : base;
        }),
      );
    },
    [commit, catalogueById],
  );

  // ---------- Alternative materials ----------
  const addPieceAlternative = useCallback(
    (id: string, name: string) => {
      commit((p) =>
        p.map((piece) => {
          if (piece.id !== id) return piece;
          if (!piece.mainMaterial) {
            // Legacy path: no main material yet → treat the pick as the main.
            const list = addMaterialToList(
              { ...form, materials_data: [] },
              materials,
              name,
            );
            return list && list.length > 0
              ? { ...piece, mainMaterial: { ...list[0], ...pieceDims(piece), is_alternative: false } }
              : piece;
          }
          // Catalog lookup for the picked material — gives us the
          // identity (name, price, currency, color, category) that
          // the new alternative row needs.
          const catalogEntry = addMaterialToList(
            { ...form, materials_data: [] },
            materials,
            name,
          );
          if (!catalogEntry || catalogEntry.length === 0) return piece;
          const catalogRow = catalogEntry[0];
          // The "same mesada, different material" invariant: the
          // alternative carries the principal's PANES, not just one.
          // We materialise ONE alternative row per main row (anchor +
          // every `mainMaterialRows` tramo), each with the catalog
          // material's identity/prices but the principal row's dims.
          // Previously the helper returned a single row using only
          // `pieceDims(piece)` (the anchor), silently dropping every
          // additional pane — that was the bug.
          const mainRows = [
            piece.mainMaterial,
            ...(piece.mainMaterialRows || []),
          ].filter(Boolean) as MaterialInForm[];
          const next: MaterialInForm[] = mainRows.map((row) => ({
            ...catalogRow,
            length: Number(row.length) || 0,
            width: Number(row.width) || 0,
            quantity: Number(row.quantity) || 1,
            m2_used: 0,
            m2_budgeted: 0,
            is_alternative: true,
          }));
          return { ...piece, alternativeMaterials: next };
        }),
      );
    },
    [commit, form, materials],
  );

  const addPieceAlternativeRow = useCallback(
    (id: string, groupKey: string, mat: MaterialInForm) => {
      commit((p) =>
        p.map((piece) => {
          if (piece.id !== id) return piece;
          // Strictly LOCAL: append the new pane to the alternative's
          // own rows. Do NOT touch the principal or other alternatives.
          const alts = piece.alternativeMaterials || [];
          const firstInGroup = alts.find((a) => groupKeyOf(a) === groupKey);
          // The new pane keeps the card's existing identity (price,
          // currency, color) — `mat` is the card's anchor row, so just
          // blank the dims and increment quantity is NOT needed (always
          // 1 by default). If `mat` lacks a name we fall back to the
          // first row of the group to keep the card coherent.
          const identity = mat && mat.name ? mat : (firstInGroup ?? mat);
          const newRow: MaterialInForm = {
            ...identity,
            quantity: 1,
            m2_used: 0,
            m2_budgeted: 0,
            length: 0,
            width: 0,
            is_alternative: true,
          };
          return {
            ...piece,
            alternativeMaterials: [...alts, newRow],
          };
        }),
      );
    },
    [commit],
  );

  const updatePieceAlternative = useCallback(
    (id: string, groupKey: string, rowIdx: number, field: string, value: unknown) => {
      commit((p) =>
        p.map((piece) => {
          if (piece.id !== id) return piece;
          const alts = piece.alternativeMaterials || [];
          // Find the rowIdx-th row of the matching group and update only it.
          const newAlts: MaterialInForm[] = [];
          let seenInGroup = -1;
          let updated = false;
          for (const alt of alts) {
            if (groupKeyOf(alt) === groupKey) {
              seenInGroup++;
              if (seenInGroup === rowIdx && !updated) {
                newAlts.push({ ...alt, [field]: value } as MaterialInForm);
                updated = true;
                continue;
              }
            }
            newAlts.push(alt);
          }
          const base = { ...piece, alternativeMaterials: newAlts };
          return FRENTE_PRICE_FIELDS.has(field)
            ? refreshPieceFrentes(base, catalogueById)
            : base;
        }),
      );
    },
    [commit, catalogueById],
  );

  const updatePieceAlternativeGroup = useCallback(
    (id: string, groupKey: string, field: string, value: unknown) => {
      commit((p) =>
        p.map((piece) => {
          if (piece.id !== id) return piece;
          // Apply to EVERY pane inside the same alternative card. The
          // card-level shared price input (in SingularMaterialCard's
          // `onUpdateGroup`) routes here so the operator only has to type
          // the price once per material.
          const newAlts = (piece.alternativeMaterials || []).map((a) =>
            groupKeyOf(a) === groupKey
              ? ({ ...a, [field]: value } as MaterialInForm)
              : a,
          );
          const base = { ...piece, alternativeMaterials: newAlts };
          return FRENTE_PRICE_FIELDS.has(field)
            ? refreshPieceFrentes(base, catalogueById)
            : base;
        }),
      );
    },
    [commit, catalogueById],
  );

  const swapPieceAlternative = useCallback(
    (id: string, groupKey: string, mat: Material) => {
      commit((p) =>
        p.map((piece) => {
          if (piece.id !== id) return piece;
          // Swap the material identity (name, price, color, currency)
          // for EVERY pane of the group. Pane dims survive.
          const alts = piece.alternativeMaterials || [];
          const swapped: MaterialInForm = {
            id: mat.id ?? null,
            name: mat.name,
            category: '',
            color: mat.color || '',
            price_m2: Number(mat.base_price) || 0,
            price_m2_usd: Number(mat.price_usd) || 0,
            currency: (mat.currency === 'USD' ? 'USD' : 'ARS') as 'ARS' | 'USD',
            quantity: 1,
            m2_used: 0,
            m2_budgeted: 0,
            length: 0,
            width: 0,
            is_alternative: true,
          };
          const newAlts = alts.map((a) =>
            groupKeyOf(a) === groupKey ? { ...a, ...swapped, length: a.length, width: a.width } : a,
          );
          // Re-point fabrication / additional-works references if the
          // name changed (mirrors `swapPieceMain`).
          const oldName = alts.find((a) => groupKeyOf(a) === groupKey)?.name;
          if (oldName && oldName !== mat.name) {
            const oldRows = alts.filter((a) => groupKeyOf(a) === groupKey);
            const synth: EntityFormState = {
              ...form,
              materials_data: oldRows,
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
            const base: BudgetPiece = {
              ...piece,
              alternativeMaterials: newAlts,
              fabrication_details: refs.fabrication_details,
              additional_works_data: refs.additional_works_data ?? '[]',
            };
            return refreshPieceFrentes(base, catalogueById);
          }
          return refreshPieceFrentes({ ...piece, alternativeMaterials: newAlts }, catalogueById);
        }),
      );
    },
    [commit, form, catalogueById],
  );

  const removePieceAlternativeRow = useCallback(
    (id: string, groupKey: string, rowIdx: number) => {
      commit((p) =>
        p.map((piece) => {
          if (piece.id !== id) return piece;
          const alts = piece.alternativeMaterials || [];
          // Drop the rowIdx-th row of the group; keep everything else.
          const newAlts: MaterialInForm[] = [];
          let seenInGroup = -1;
          for (const alt of alts) {
            if (groupKeyOf(alt) === groupKey) {
              seenInGroup++;
              if (seenInGroup === rowIdx) continue;
            }
            newAlts.push(alt);
          }
          return { ...piece, alternativeMaterials: newAlts };
        }),
      );
    },
    [commit],
  );

  const removePieceAlternative = useCallback(
    (id: string, groupKey: string) => {
      commit((p) =>
        p.map((piece) => {
          if (piece.id !== id) return piece;
          // Drop EVERY pane of the group (whole card).
          const newAlts = (piece.alternativeMaterials || []).filter(
            (a) => groupKeyOf(a) !== groupKey,
          );
          return { ...piece, alternativeMaterials: newAlts };
        }),
      );
    },
    [commit],
  );

  const togglePieceAlternative = useCallback(
    (id: string, groupKey: string) => {
      commit((p) =>
        p.map((piece) => {
          if (piece.id !== id) return piece;
          const alts = piece.alternativeMaterials || [];
          const groupRows = alts.filter((a) => groupKeyOf(a) === groupKey);
          if (groupRows.length === 0) return piece;
          const remainingAlts = alts.filter((a) => groupKeyOf(a) !== groupKey);
          const previousMain = piece.mainMaterial;
          // Promote the FIRST pane of the group to the principal anchor;
          // the rest of the group's panes become `mainMaterialRows` so
          // the operator's measurements carry over without retyping.
          const newMain: MaterialInForm = { ...groupRows[0], is_alternative: false };
          const newMainRows: MaterialInForm[] = groupRows.slice(1).map((r) => ({
            ...r,
            is_alternative: false,
          }));
          // The previous main (if any) is demoted to an alternative with
          // its panes so the swap keeps every measurement the operator
          // had entered.
          const newAlts = previousMain
            ? [
                { ...previousMain, is_alternative: true },
                ...(piece.mainMaterialRows || []).map((r) => ({
                  ...r,
                  is_alternative: true,
                })),
                ...remainingAlts,
              ]
            : remainingAlts;
          return refreshPieceFrentes(
            {
              ...piece,
              mainMaterial: newMain,
              mainMaterialRows: newMainRows,
              alternativeMaterials: newAlts,
            },
            catalogueById,
          );
        }),
      );
    },
    [commit, catalogueById],
  );

  // ---------- Piece fabrication rows ----------
  const addPieceFabrication = useCallback(
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

  const updatePieceFabrication = useCallback(
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
              { materials, materialPriceArs: ars, materialUsd: usd, fallbackMaterialPriceM2: ars },
            ),
          };
        }),
      );
    },
    [commit, materials],
  );

  const removePieceFabrication = useCallback(
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
