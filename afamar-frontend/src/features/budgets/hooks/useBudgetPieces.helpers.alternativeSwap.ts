/**
 * SWAP / TOGGLE of an alternative material card (pieces-flow).
 *
 * Both operations change the IDENTITY of the card relative to the
 * principal material:
 *  - `mutateSwapPieceAlternative` replaces the material of every pane of
 *    the group (name, price, color, currency) keeping the measures.
 *  - `mutateTogglePieceAlternative` promotes the group to the principal
 *    material and demotes the previous principal to an alternative.
 *
 * They live together because both must re-point the piece's references
 * (fabricación / adicionales) and re-price the frentes afterwards.
 */
import type { Material } from '@/types/material';
import type { EntityFormState } from '@/types';
import type { BudgetPiece, MaterialInForm } from '@/types/budget';
import type { AdditionalWork } from '@/types/additionalWork';
import { repointSwapReferences } from '@/hooks/entityFormHelpers';
import { groupKeyOf } from './useBudgetPieces.helpers.pieces';
import { refreshPieceFrentes } from './useBudgetPieces.helpers.pricing';

export function mutateSwapPieceAlternative(
  piece: BudgetPiece,
  form: EntityFormState,
  groupKey: string,
  mat: Material,
  catalogueById: Map<number, AdditionalWork>,
): BudgetPiece {
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
}

export function mutateTogglePieceAlternative(
  piece: BudgetPiece,
  groupKey: string,
  catalogueById: Map<number, AdditionalWork>,
): BudgetPiece {
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
}
