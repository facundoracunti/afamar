/**
 * FABRICATION ROWS (zócalos / frentes) of a piece.
 *
 * These are the manual rows the operator adds to a piece (`BASEBOARD`
 * and friends). They are re-priced by
 * `useBudgetPieces.helpers.pricing.refreshPieceFabricationDetails`
 * whenever the linked material's $/m² changes.
 */
import type { Material } from '@/types/material';
import type { BudgetPiece, FabricationDetail, MaterialInForm } from '@/types/budget';
import { recomputeFabricationRow } from '@features/budgets/utils/fabricationDetails';
import { pieceMainPrices } from './useBudgetPieces.helpers.pieces';

export function mutateAddPieceFabrication(piece: BudgetPiece): BudgetPiece {
  const singleMain = piece.mainMaterial;
  const base: FabricationDetail = {
    concept: 'BASEBOARD',
    detail: '',
    material: singleMain ? singleMain.name || '' : '',
    material_id: singleMain?.id ?? null,
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
    price_source: 'catalog',
  };
  return { ...piece, fabrication_details: [...piece.fabrication_details, base] };
}

export function mutateUpdatePieceFabrication(
  piece: BudgetPiece,
  idx: number,
  field: string,
  value: unknown,
  materials: Material[],
): BudgetPiece {
  const { ars, usd } = pieceMainPrices(piece);
  const pieceMaterials: MaterialInForm[] = [
    piece.mainMaterial,
    ...(piece.mainMaterialRows || []),
    ...(piece.alternativeMaterials || []),
  ].filter((material): material is MaterialInForm => Boolean(material));
  return {
    ...piece,
    fabrication_details: recomputeFabricationRow(
      piece.fabrication_details,
      idx,
      field,
      value,
      {
        materials,
        pieceMaterials,
        materialPriceArs: ars,
        materialUsd: usd,
        fallbackMaterialPriceM2: ars,
      },
    ),
  };
}

export function mutateRemovePieceFabrication(
  piece: BudgetPiece,
  idx: number,
): BudgetPiece {
  return {
    ...piece,
    fabrication_details: piece.fabrication_details.filter((_, i) => i !== idx),
  };
}
