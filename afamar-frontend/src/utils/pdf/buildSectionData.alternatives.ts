/**
 * The ALTERNATIVA (option) sections of the PDF document.
 *
 * Split out of `buildSectionData.ts` (which stays the public barrel) so the
 * options assembly lives alone, next to the PRINCIPAL assembly
 * (`buildSectionData.main.ts`).
 */

import type { MaterialInForm } from '../../types/budget';
import { materialGroupKey } from '../materialGroups';
import { buildMaterialRows } from './buildSectionData.rows';
import {
  revalueGlobalFabricationForMaterial,
  revalueFrenteForMaterial,
} from './buildSectionData.revalue';
import type { AdditionalBuckets } from './buildSectionData.types';
import type {
  AdditionalWorkPdfRow,
  MaterialSection,
  PdfDataRow,
  PoolPdfRow,
} from './pdfTypes';

export interface AlternativeSectionsInput {
  alternatives: MaterialInForm[];
  usdRate: number;
  poolsByMaterial: Record<string, PoolPdfRow[]>;
  poolsCommon: PoolPdfRow[];
  fabricationByMaterial: Record<string, PdfDataRow[]>;
  fabricationCommon: PdfDataRow[];
  addicionalBuckets: AdditionalBuckets;
}

/**
 * Build one section per alternative option.
 *
 * Alternatives are grouped by physical material (catalogue `id`, falling
 * back to the name for legacy rows) so a material with several panes
 * collapses into ONE option section, mirroring the MaterialCard grouping
 * in the form UI. Without this, each `materials_data` row of the same
 * alternative spawned its own "ALTERNATIVA N" section.
 */
export function buildAlternativeSections({
  alternatives,
  usdRate,
  poolsByMaterial,
  poolsCommon,
  fabricationByMaterial,
  fabricationCommon,
  addicionalBuckets,
}: AlternativeSectionsInput): MaterialSection[] {
  const builtAlternatives: MaterialSection[] = [];
  const altGroups = new Map<string, MaterialInForm[]>();
  for (const alt of alternatives) {
    const groupKey = materialGroupKey(alt);
    const group = altGroups.get(groupKey);
    if (group) group.push(alt);
    else altGroups.set(groupKey, [alt]);
  }
  let altIdx = 0;
  for (const [, altGroup] of altGroups) {
    const representative = altGroup[0];
    const altMaterialRows = buildMaterialRows(altGroup, usdRate);
    // A GLOBAL (unassigned) m² fabrication row (ZÓCALO) and a GLOBAL frente
    // have no material of their own, so they render "sin ningún valor" ($0).
    // Fold them into each option revalued with THAT option's material price —
    // regardless of whether a principal exists, so a GLOBAL frente / zócalo
    // appears in every section, just like a flat GLOBAL additional work.
    const altFabrication: PdfDataRow[] = [
      ...fabricationCommon.map((f) =>
        revalueGlobalFabricationForMaterial(f, representative, usdRate),
      ),
      ...(fabricationByMaterial[representative.name] ?? []),
    ];
    const altPools: PoolPdfRow[] = [
      ...poolsCommon,
      ...(poolsByMaterial[representative.name] ?? []),
    ];
    const altAdditional: AdditionalWorkPdfRow[] = [
      ...addicionalBuckets.additionalCommon.map((a) =>
        revalueFrenteForMaterial(a, representative, usdRate),
      ),
      ...(addicionalBuckets.additionalByMaterial[representative.name] ?? []).map((a) =>
        revalueFrenteForMaterial(a, representative, usdRate),
      ),
    ];
    const altAdditionArs = altAdditional.reduce((s, a) => s + a.subtotal_ars, 0);
    const altAdditionUsd = altAdditional.reduce((s, a) => s + a.subtotal_usd, 0);
    const altSubtotalArs =
      altMaterialRows.reduce((s, r) => s + r.subtotal_ars, 0) +
      altPools.reduce((s, r) => s + r.subtotal_ars, 0) +
      altFabrication.reduce((s, r) => s + r.subtotal_ars, 0) +
      altAdditionArs;
    const altSubtotalUsd =
      altMaterialRows.reduce((s, r) => s + r.subtotal_usd, 0) +
      altPools.reduce((s, r) => s + r.subtotal_usd, 0) +
      altFabrication.reduce((s, r) => s + r.subtotal_usd, 0) +
      altAdditionUsd;
    builtAlternatives.push({
      title: `ALTERNATIVA ${altIdx + 1}: ${representative.name}`,
      is_main: false,
      is_global: false,
      alternative_index: altIdx,
      material_name: representative.name,
      materials: altMaterialRows,
      pools: altPools,
      fabrication_details: altFabrication,
      additional_works: altAdditional,
      subtotal_ars: altSubtotalArs,
      subtotal_usd: altSubtotalUsd,
    });
    altIdx += 1;
  }
  return builtAlternatives;
}
