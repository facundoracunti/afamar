/**
 * PRINCIPAL MATERIAL mutators of the pieces-flow (`useBudgetPieces`).
 *
 * Each `mutate*` function applies ONE operation to a single piece and
 * returns a NEW piece (immutably) — the hook's `commit` wrapper is
 * responsible for the `id` guard, array mapping and flat re-derivation.
 *
 * The principal material of a piece is the ANCHOR row plus its extra
 * measurement rows ("tramos", `mainMaterialRows`): the card shows them as
 * ONE card with N panes, and a shared price input prices every pane at
 * once (the "same physical material" rule).
 */
import type { Material } from '@/types/material';
import type { EntityFormState } from '@/types';
import type { BudgetPiece, MaterialInForm } from '@/types/budget';
import type { AdditionalWork } from '@/types/additionalWork';
import { addMaterialToList, repointSwapReferences } from '@/hooks/entityFormHelpers';
import { FRENTE_PRICE_FIELDS, pieceDims } from './useBudgetPieces.helpers.pieces';
import {
  refreshPieceFabricationDetails,
  refreshPieceFrentes,
} from './useBudgetPieces.helpers.pricing';

export function mutateSetPieceMain(
  piece: BudgetPiece,
  form: EntityFormState,
  materials: Material[],
  name: string,
): BudgetPiece {
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
}

export function mutateUpdatePieceMain(
  piece: BudgetPiece,
  field: string,
  value: unknown,
  catalogueById: Map<number, AdditionalWork>,
): BudgetPiece {
  if (!piece.mainMaterial) return piece;
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
}

export function mutateSwapPieceMain(
  piece: BudgetPiece,
  form: EntityFormState,
  mat: Material,
  catalogueById: Map<number, AdditionalWork>,
): BudgetPiece {
  if (!piece.mainMaterial) return piece;
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
}

export function mutateRemovePieceMain(piece: BudgetPiece): BudgetPiece {
  return { ...piece, mainMaterial: null, mainMaterialRows: [] };
}

export function mutateAddPieceMainRow(
  piece: BudgetPiece,
  mat: MaterialInForm,
): BudgetPiece {
  if (!piece.mainMaterial) return piece;
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
}

export function mutateUpdatePieceMainRow(
  piece: BudgetPiece,
  idx: number,
  field: string,
  value: unknown,
): BudgetPiece {
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
}

export function mutateRemovePieceMainRow(
  piece: BudgetPiece,
  idx: number,
): BudgetPiece {
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
}

export function mutateUpdatePieceMainGroup(
  piece: BudgetPiece,
  field: string,
  value: unknown,
  catalogueById: Map<number, AdditionalWork>,
): BudgetPiece {
  if (!piece.mainMaterial) return piece;
  const updatedMain = { ...piece.mainMaterial, [field]: value } as MaterialInForm;
  const base = {
    ...piece,
    mainMaterial: updatedMain,
    mainMaterialRows: (piece.mainMaterialRows || []).map((row) => ({
      ...row,
      [field]: value,
    })),
  };
  // Price / currency edits affect EVERY row whose `material` matches the
  // principal's name — frentes (additional_works_data) re-price via
  // `refreshPieceFrentes`; m² fabrication rows (fabrication_details)
  // re-price via `refreshPieceFabricationDetails`. Without this call
  // zócalos captured `material_price_m2` at creation time and stayed
  // frozen at the OLD subtotal even after the operator typed a new
  // price in the principal card's shared input.
  const nextFabrications = FRENTE_PRICE_FIELDS.has(field)
    ? refreshPieceFabricationDetails(piece.fabrication_details, updatedMain)
    : piece.fabrication_details;
  const pieceWithFab = { ...base, fabrication_details: nextFabrications };
  const result = FRENTE_PRICE_FIELDS.has(field)
    ? refreshPieceFrentes(pieceWithFab, catalogueById)
    : pieceWithFab;
  return result;
}
