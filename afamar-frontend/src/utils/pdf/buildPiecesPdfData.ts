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

import type { BudgetPiece, FabricationDetail, MaterialInForm } from '../../types/budget';
import type { PiecesPdfPiece } from './pdfTypes';
import { materialGroupKey } from '../materialGroups';
import {
  buildAdditionalWorksRows,
  buildFabricationRows,
  buildMaterialRows,
  buildPoolRows,
  revalueM2FabricationForMaterial,
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

  // Document-level fabrication rows (Calculator de Zócalos, etc.). The
  // calculator writes to `form.fabrication_details` (it has no piece
  // context), while pieces v3 stores fabrication per-piece. Pieces v3 has
  // no "active piece" concept, so we attach the calculator's items to
  // the FIRST piece (the primary mesada) and dedup by (concept, detail)
  // — a fabrication row is only "document-level" when its key is owned by
  // NO piece. `form.fabrication_details` is the flattened union of every
  // piece's own rows (via `flattenPieces`), so a row authored in piece N
  // (e.g. a "ANTEBAÑO Y TOILETTE" zócalo) must NOT leak into piece 0's
  // PDF block: we first collect the keys of ALL pieces and skip any row
  // that belongs to one of them.
  const rawDocFab = ((form as { fabrication_details?: FabricationDetail[] | undefined }).fabrication_details) || [];
  const docFabRows: PdfDataRow[] = buildFabricationRows(rawDocFab, usdRate);
  const docFabKey = (r: PdfDataRow) => `${r.concept}__${r.detail ?? ''}`;
  const docFabByKey = new Map<string, PdfDataRow>();
  for (const r of docFabRows) {
    const k = docFabKey(r);
    if (!docFabByKey.has(k)) docFabByKey.set(k, r);
  }
  // Every fabrication key owned by ANY piece. These must be excluded from
  // the primary-piece merge below, otherwise a row flattened from piece N
  // renders again inside piece 0 (double-billing + wrong piece attribution).
  const allPieceFabKeys = new Set<string>();
  for (const p of raw as BudgetPiece[]) {
    if (!p) continue;
    for (const fr of buildFabricationRows(
      Array.isArray(p.fabrication_details) ? p.fabrication_details : [],
      usdRate,
    )) {
      allPieceFabKeys.add(docFabKey(fr));
    }
  }

  const result: PiecesPdfPiece[] = [];
  for (let pieceIndex = 0; pieceIndex < (raw as BudgetPiece[]).length; pieceIndex++) {
    const piece = (raw as BudgetPiece[])[pieceIndex];
    if (!piece) continue;

    const mainList: MaterialInForm[] = piece.mainMaterial
      ? [piece.mainMaterial, ...(piece.mainMaterialRows || [])]
      : [];
    const altList: MaterialInForm[] = Array.isArray(piece.alternativeMaterials)
      ? piece.alternativeMaterials
      : [];
    const piecePools = Array.isArray(piece.pools) ? piece.pools : [];

    const mainRows = buildMaterialRows(mainList, usdRate);
    const pieceFabRows = buildFabricationRows(piece.fabrication_details, usdRate);
    // Only the primary piece inherits the calculator's docFab rows. Other
    // pieces keep their own fabrication (no cross-piece leak). Within the
    // primary piece, dedup by (concept, detail) so a row that was
    // flattened into the form column by `flattenPieces` doesn't render
    // twice, and drop any key that belongs to another piece.
    let fabRows: PdfDataRow[] = pieceFabRows;
    if (pieceIndex === 0) {
      const seen = new Set(pieceFabRows.map(docFabKey));
      const merged = pieceFabRows.slice();
      for (const r of docFabByKey.values()) {
        const k = docFabKey(r);
        if (!seen.has(k) && !allPieceFabKeys.has(k)) {
          merged.push(r);
          seen.add(k);
        }
      }
      fabRows = merged;
    }
    const adicRows = buildAdditionalWorksRows(
      { ...form, additional_works_data: piece.additional_works_data },
      usdRate,
    );
    const poolRows: PoolPdfRow[] = buildPoolRows(piecePools, usdRate);

    // Every m² fabrication row authored without a material (typical for
    // calculator zócalo rows / empty `material` field) inherits the piece's
    // principal material name so the PDF's Material column never shows "—"
    // for a m² concept. Alternatives override it with their own name below.
    const pieceMainName = piece.mainMaterial?.name || '';
    fabRows = fabRows.map((r) =>
      r.show_m2 && !r.material && pieceMainName ? { ...r, material: pieceMainName } : r,
    );

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
      // m² concepts (ZÓCALO / FRENTE / BASEBOARD / FRONT) are ALSO re-priced
      // against the ALTERNATIVE's material $/m² (`m² × $/m²`), so an
      // alternative never inherits the principal's frozen price (0.405 m²
      // at the alternative's 350 USD/m² = USD 141,75, not the principal's
      // 275,40). Non-m² rows keep their stored price.
      const altFabrication: PdfDataRow[] = fabRows.map((f) => {
        const r = revalueM2FabricationForMaterial(f, representative, usdRate);
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
