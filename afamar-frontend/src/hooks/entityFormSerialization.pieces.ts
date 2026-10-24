/**
 * Loading the PIECES (mesadas) of a budget / work order from the API.
 *
 * Split out of `entityFormSerialization.ts` (which stays the public
 * barrel) so the legacy → pieces v3 migration and the snapshot hydration
 * live in one place.
 */

import { flattenPieces, normalisePieces } from '@features/budgets/utils/pieces';
import type { BudgetPiece, PoolInForm } from '../types/budget';
import { hydratePiecesSnapshots } from './entityForm/piecesHydration';
import { isLegacyAlternative, jsonParseList } from './entityFormSerialization.helpers';

/** Single source of truth for the pieces + their derived flat columns.
 *
 *  Pieces v3 guarantees the form always has ≥ 1 piece. When the backend
 *  returns no `pieces_data` (legacy budget), we fold the legacy flat
 *  arrays (`materials_data`, `fabrication_details`, `additional_works_data`,
 *  `pools_data`) into the auto-created first piece so nothing is lost on
 *  the first save. The `pools_data` returned to the form is then derived
 *  from the resulting pieces via `flattenPieces`, guaranteeing the flat
 *  column and the per-piece pools never drift. */
export function loadPieces(
  d: Record<string, unknown>,
): { pieces: BudgetPiece[]; pools_data: PoolInForm[] } {
  const pieces = normalisePieces(d.pieces_data);
  const hadPiecesData =
    (typeof d.pieces_data === 'string' && d.pieces_data.length > 0) ||
    (Array.isArray(d.pieces_data) && (d.pieces_data as unknown[]).length > 0);

  if (!hadPiecesData) {
    const legacyMats = jsonParseList(d.materials_data) as Array<Record<string, unknown>>;
    if (legacyMats.length > 0 && pieces.length === 1 && pieces[0].mainMaterial === null) {
      const legacyMains = legacyMats.filter((m) => !isLegacyAlternative(m));
      const firstMain = legacyMains[0] || null;
      // Extra non-alternative rows (legacy "panes" of the principal) become
      // `mainMaterialRows` tramos — each keeps its own dims so the re-split
      // UI can show/editar every tramo after loading a legacy budget.
      const mainRows = legacyMains
        .slice(1)
        .map((m) => ({ ...m, is_alternative: false })) as BudgetPiece['mainMaterialRows'];
      const alts = legacyMats
        .filter(isLegacyAlternative)
        .map((m) => ({ ...m, is_alternative: true })) as BudgetPiece['alternativeMaterials'];
      const legacyFab = jsonParseList(d.fabrication_details) as BudgetPiece['fabrication_details'];
      const legacyAdd = (typeof d.additional_works_data === 'string' && d.additional_works_data)
        ? d.additional_works_data
        : '[]';
      const legacyPools = jsonParseList(d.pools_data) as BudgetPiece['pools'];
      pieces[0] = {
        ...pieces[0],
        mainMaterial: firstMain
          ? ({ ...firstMain, is_alternative: false } as BudgetPiece['mainMaterial'])
          : null,
        mainMaterialRows: mainRows,
        alternativeMaterials: alts,
        fabrication_details: legacyFab,
        additional_works_data: legacyAdd,
        pools: legacyPools,
      };
    }
  }

  // Copy the budgeted-measurement snapshots (m²/ml + ARS/USD at
  // conversion) from the API's flat arrays onto the pieces so they
  // survive the pieces→flat re-derivation on every edit (see
  // `hydratePiecesSnapshots`). Without this the COMPARATIVA DE
  // MEDICIÓN loses the "Presupuestado" column at the first measurement
  // change and the flat `flattenPieces` output below would diverge from
  // the API's snapshot-carrying flat arrays.
  const hydrated = hydratePiecesSnapshots(d, pieces);

  return {
    pieces: hydrated,
    pools_data: flattenPieces(hydrated).pools_data,
  };
}
