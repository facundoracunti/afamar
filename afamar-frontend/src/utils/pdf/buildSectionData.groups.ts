/**
 * Bucketing helpers for the PDF section builder.
 *
 * Pool rows and fabrication rows are LINKED to a material (or not, when
 * they are "GLOBAL" / unassigned). The section builder groups them by
 * that link so each option section can carry the rows of its own material
 * plus the unassigned ones (revalued against the section's material).
 */

import { POOL_MATERIAL_GLOBAL } from '../../types/budget';
import type { PdfDataRow, PoolPdfRow } from './pdfTypes';

/** Pool rows split by the material they are linked to (+ the unassigned). */
export interface PoolGroups {
  poolsByMaterial: Record<string, PoolPdfRow[]>;
  poolsCommon: PoolPdfRow[];
}

/** Fabrication rows split by the material they are linked to (+ unassigned). */
export interface FabricationGroups {
  fabricationByMaterial: Record<string, PdfDataRow[]>;
  fabricationCommon: PdfDataRow[];
}

/**
 * Split the pool rows: linked ones by material name, the rest (no link or
 * the GLOBAL marker) as the common bucket.
 */
export function groupPoolRows(allPoolRows: PoolPdfRow[]): PoolGroups {
  const poolsByMaterial: Record<string, PoolPdfRow[]> = {};
  const poolsCommon: PoolPdfRow[] = [];
  for (const poolRow of allPoolRows) {
    const linkedMaterial = poolRow.material;
    if (!linkedMaterial || linkedMaterial === POOL_MATERIAL_GLOBAL) {
      poolsCommon.push(poolRow);
    } else {
      if (!poolsByMaterial[linkedMaterial]) poolsByMaterial[linkedMaterial] = [];
      poolsByMaterial[linkedMaterial].push(poolRow);
    }
  }
  return { poolsByMaterial, poolsCommon };
}

/**
 * Split the fabrication rows: linked ones by material name, the rest (no
 * link) as the common bucket.
 */
export function groupFabricationRows(fabricationRows: PdfDataRow[]): FabricationGroups {
  const fabricationByMaterial: Record<string, PdfDataRow[]> = {};
  const fabricationCommon: PdfDataRow[] = [];
  for (const row of fabricationRows) {
    const detailMaterial = row.material;
    if (detailMaterial && detailMaterial.length > 0) {
      if (!fabricationByMaterial[detailMaterial]) fabricationByMaterial[detailMaterial] = [];
      fabricationByMaterial[detailMaterial].push(row);
    } else {
      fabricationCommon.push(row);
    }
  }
  return { fabricationByMaterial, fabricationCommon };
}
