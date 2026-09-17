/**
 * Multi-piece PDF data builder (`pieces_data`).
 *
 * A budget in the new flow stores its mesadas in `form.pieces`; each piece
 * owns exactly one main material, a list of alternative materials, its own
 * zócalo/frente rows, its own additional works AND its own piletas. The
 * legacy document-level arrays (`materials_data`, `fabrication_details`,
 * `additional_works_data`, `pools_data`) are the flattened union of every
 *  piece — `useBudgetPieces` keeps them in sync. This builder re-splits the
 * union back per piece so the renderer can draw:
 *
 *   - Page 1 (PRESUPUESTO PRINCIPAL): one self-contained block per piece
 *     (main material + zócalo/frente + additional works + piletas +
 *     subtotal), the general totals.
 *   - Page 2 (HOJA DE ALTERNATIVAS): grouped by piece, one row per quoted
 *     alternative. The piece's piletas are INHERITED by every alternative
 *     (raw — pools aren't revalued against the alternative's material,
 *     matching the legacy `buildSections` behaviour).
 *
 * Totals: a piece's PRINCIPAL subtotal = main material + zócalo/frente +
 * additional works + piletas. Its alternatives swap the material, revalue
 * $0 zócalo/frente and $0 frente rows against the new material, and add
 * the piece's piletas verbatim. So `Σ piece.principal + documentGlobal
 * (none in pieces mode)` = the document subtotal, with no double counting.
 */

import type { BudgetPiece, MaterialInForm } from '../../types/budget';
import type { PiecesPdfPiece } from './pdfTypes';
import { materialGroupKey } from '../materialGroups';
import {
  buildAdditionalWorksRows,
  buildFabricationRows,
  buildMaterialRows,
  buildPoolRows,
  revalueGlobalFabricationForMaterial,
  revalueGlobalFrenteForMaterial,
} from './buildSectionData';
import type {
  AdditionalWorkPdfRow,
  PdfDataRow,
  PoolPdfRow,
} from './pdfTypes';

function sumArs(rows: Array<{ subtotal_ars: number }>): number {
  return rows.reduce((sum, r) => sum + (Number(r.subtotal_ars) || 0), 0);
}

function sumUsd(rows: Array<{ subtotal_usd: number }>): number {
  return rows.reduce((sum, r) => sum + (Number(r.subtotal_usd) || 0), 0);
}

/**
 * Build the per-piece PDF blocks from `form.pieces`. Returns `[]` for a
 * legacy budget (no pieces), so `buildPdfData` can fall back to the
 * sections layout untouched.
 */
export function buildPieces(
  form: Record<string, unknown>,
  usdRate: number,
): PiecesPdfPiece[] {
  const raw = (form as { pieces?: unknown }).pieces;
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const result: PiecesPdfPiece[] = [];
  for (const piece of raw as BudgetPiece[]) {
    if (!piece) continue;

    const mainList: MaterialInForm[] = piece.mainMaterial ? [piece.mainMaterial] : [];
    const altList: MaterialInForm[] = Array.isArray(piece.alternativeMaterials)
      ? piece.alternativeMaterials
      : [];
    const piecePools = Array.isArray(piece.pools) ? piece.pools : [];

    const mainRows = buildMaterialRows(mainList, usdRate);
    const fabRows = buildFabricationRows(piece.fabrication_details, usdRate);
    const adicRows = buildAdditionalWorksRows(
      { ...form, additional_works_data: piece.additional_works_data },
      usdRate,
    );
    const poolRows: PoolPdfRow[] = buildPoolRows(piecePools, usdRate);

    // Group the piece's alternatives by physical material so several panes
    // of the same material collapse into ONE option (same rule as the
    // legacy `buildSections`).
    const altGroups = new Map<string, MaterialInForm[]>();
    for (const alt of altList) {
      const key = materialGroupKey(alt);
      const group = altGroups.get(key);
      if (group) group.push(alt);
      else altGroups.set(key, [alt]);
    }

    const alternatives = [...altGroups.values()].map((group, i) => {
      const representative = group[0];
      const altMaterialRows = buildMaterialRows(group, usdRate);
      // Replace the `material` field on every zócalo/frente row with the
      // alternative material name — the rows were authored against the
      // principal so the label still reads "ABSOLUTE WHITE" otherwise.
      // The `$0` revalue (price/area) is preserved alongside.
      const altFabrication: PdfDataRow[] = fabRows.map((f) => {
        const r = revalueGlobalFabricationForMaterial(f, representative, usdRate);
        return { ...r, material: representative.name || '' };
      });
      // Same treatment for additional works (traforos, frentes): the
      // `materialName` field is overwritten so the customer sees the
      // alternative material on the row, not the principal.
      const altAdditional: AdditionalWorkPdfRow[] = adicRows.map((a) => {
        const r = revalueGlobalFrenteForMaterial(a, representative, usdRate);
        return { ...r, materialName: representative.name || '' };
      });
      // Pools travel with the piece (no revaluation — the legacy
      // sections layout doesn't revalue pools either).
      return {
        title: `Alternativa ${i + 1}: ${representative.name || ''}`.trim(),
        material_name: representative.name || '',
        materials: altMaterialRows,
        fabrication_details: altFabrication,
        additional_works: altAdditional,
        pools: poolRows,
        subtotal_ars:
          sumArs(altMaterialRows) +
          sumArs(altFabrication) +
          sumArs(altAdditional) +
          sumArs(poolRows),
        subtotal_usd:
          sumUsd(altMaterialRows) +
          sumUsd(altFabrication) +
          sumUsd(altAdditional) +
          sumUsd(poolRows),
      };
    });

    result.push({
      id: piece.id || '',
      name: piece.name || 'Pieza',
      materials: mainRows,
      fabrication_details: fabRows,
      additional_works: adicRows,
      pools: poolRows,
      subtotal_ars:
        sumArs(mainRows) + sumArs(fabRows) + sumArs(adicRows) + sumArs(poolRows),
      subtotal_usd:
        sumUsd(mainRows) + sumUsd(fabRows) + sumUsd(adicRows) + sumUsd(poolRows),
      alternatives,
    });
  }
  return result;
}

/**
 * Sum of every piece's principal subtotal (pools already included — those
 * moved out of the document globals when pieces came in v2).
 */
export function piecesSubtotal(pieces: PiecesPdfPiece[]): { ars: number; usd: number } {
  return {
    ars: pieces.reduce((sum, p) => sum + (Number(p.subtotal_ars) || 0), 0),
    usd: pieces.reduce((sum, p) => sum + (Number(p.subtotal_usd) || 0), 0),
  };
}
