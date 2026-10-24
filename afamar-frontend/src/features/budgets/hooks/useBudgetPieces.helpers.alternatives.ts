/**
 * ALTERNATIVE MATERIAL mutators of the pieces-flow (`useBudgetPieces`).
 *
 * An "alternative" is a variant of the piece quoted with a DIFFERENT
 * material but the SAME mesada (measurements). Rows are grouped by
 * material identity (`groupKeyOf`) so ONE card can hold N panes
 * ("tramos") of the same alternative material.
 *
 * Blocked invariants preserved from the original single-file hook:
 * - "same mesada, different material": alternatives mirror the
 *   principal's length/width/quantity.
 * - Append, never replace, for alternatives (each new pick adds a slot;
 *   re-picking an already-present material is a no-op via `groupKeyOf`).
 */
import type { Material } from '@/types/material';
import type { EntityFormState } from '@/types';
import type { BudgetPiece, MaterialInForm } from '@/types/budget';
import type { AdditionalWork } from '@/types/additionalWork';
import { addMaterialToList } from '@/hooks/entityFormHelpers';
import { FRENTE_PRICE_FIELDS, groupKeyOf, pieceDims } from './useBudgetPieces.helpers.pieces';
import {
  refreshPieceFabricationDetails,
  refreshPieceFrentes,
} from './useBudgetPieces.helpers.pricing';

export function mutateAddPieceAlternative(
  piece: BudgetPiece,
  form: EntityFormState,
  materials: Material[],
  name: string,
): BudgetPiece {
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
  const existing = piece.alternativeMaterials || [];
  // A material already present as an alternative is a no-op: the
  // picker does NOT filter already-picked entries, and appending
  // it would create two cards with the same group key (duplicate
  // React keys + a duplicated material choice).
  const pickedKey = String(catalogRow.id ?? catalogRow.name);
  if (existing.some((a) => groupKeyOf(a) === pickedKey)) return piece;
  const next: MaterialInForm[] = mainRows.map((row) => ({
    ...catalogRow,
    length: Number(row.length) || 0,
    width: Number(row.width) || 0,
    quantity: Number(row.quantity) || 1,
    m2_used: 0,
    m2_budgeted: 0,
    is_alternative: true,
  }));
  // APPEND, never replace: each new pick adds a new alternative
  // slot, keeping every previously-picked alternative intact.
  return { ...piece, alternativeMaterials: [...existing, ...next] };
}

export function mutateAddPieceAlternativeRow(
  piece: BudgetPiece,
  groupKey: string,
  mat: MaterialInForm,
): BudgetPiece {
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
}

export function mutateUpdatePieceAlternative(
  piece: BudgetPiece,
  groupKey: string,
  rowIdx: number,
  field: string,
  value: unknown,
  catalogueById: Map<number, AdditionalWork>,
): BudgetPiece {
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
}

export function mutateUpdatePieceAlternativeGroup(
  piece: BudgetPiece,
  groupKey: string,
  field: string,
  value: unknown,
  catalogueById: Map<number, AdditionalWork>,
): BudgetPiece {
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
  // Same re-pricing discipline as `mutateUpdatePieceMainGroup`: a price
  // / currency edit on this alternative must also re-price the manual
  // fabrication rows assigned to it (otherwise its zócalos / manual
  // frentes stay frozen at the previous $/m²).
  const changedAlt = newAlts.find((a) => groupKeyOf(a) === groupKey);
  const nextFabrications =
    FRENTE_PRICE_FIELDS.has(field) && changedAlt
      ? refreshPieceFabricationDetails(piece.fabrication_details, changedAlt)
      : piece.fabrication_details;
  const pieceWithFab = { ...base, fabrication_details: nextFabrications };
  return FRENTE_PRICE_FIELDS.has(field)
    ? refreshPieceFrentes(pieceWithFab, catalogueById)
    : pieceWithFab;
}

export function mutateRemovePieceAlternativeRow(
  piece: BudgetPiece,
  groupKey: string,
  rowIdx: number,
): BudgetPiece {
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
}

export function mutateRemovePieceAlternative(
  piece: BudgetPiece,
  groupKey: string,
): BudgetPiece {
  // Drop EVERY pane of the group (whole card).
  const newAlts = (piece.alternativeMaterials || []).filter(
    (a) => groupKeyOf(a) !== groupKey,
  );
  return { ...piece, alternativeMaterials: newAlts };
}
