/**
 * PDF section-data builders: row transformation, revaluation, COMPARATIVA
 * DE MEDICIÓN and per-option section bucketing.
 *
 * The heavy lifting lives in the secondary modules (same folder):
 *
 *   - `buildSectionData.rows`       — raw form slices → PDF rows
 *   - `buildSectionData.revalue`    — global zócalo/frente revaluation
 *   - `buildSectionData.measurement`— COMPARATIVA DE MEDICIÓN rows
 *
 * This orchestrator keeps the flagship `buildSections` (materials, pools
 * and fabrication details grouped into per-option sections) and re-exports
 * the whole public API so consumers keep importing from this single path.
 */

import { POOL_MATERIAL_GLOBAL } from '../../types/budget';
import type { MaterialInForm, PoolInForm } from '../../types/budget';
import { materialGroupKey } from '../materialGroups';
import type {
  PdfDataRow,
  MaterialPdfRow,
  PoolPdfRow,
  AdditionalWorkPdfRow,
  MaterialSection,
} from './pdfTypes';
import { buildMaterialRows, buildPoolRows } from './buildSectionData.rows';
import {
  revalueGlobalFabricationForMaterial,
  revalueGlobalFrenteForMaterial,
  revalueFrenteForMaterial,
} from './buildSectionData.revalue';
import type { AdditionalBuckets, SectionsResult } from './buildSectionData.types';

/**
 * Group materials, pools and fabrication details into per-option sections.
 */
export function buildSections(
  allMaterials: MaterialInForm[],
  alternatives: MaterialInForm[],
  pools: PoolInForm[],
  fabricationRows: PdfDataRow[],
  usdRate: number,
  addicionalBuckets: AdditionalBuckets = { additionalByMaterial: {}, additionalCommon: [] },
): SectionsResult {
  const mainMaterials = allMaterials.filter((m) => !m.is_alternative);
  const flatMaterials: MaterialPdfRow[] = [];
  const flatPools: PoolPdfRow[] = [];
  const flatFabrication: PdfDataRow[] = [];
  const sections: MaterialSection[] = [];

  const mainMaterialRows = buildMaterialRows(mainMaterials, usdRate);
  const allPoolRows = buildPoolRows(pools, usdRate);

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

  // Main section
  const hasMain = mainMaterials.length > 0;

  // GLOBAL (unassigned) zócalos / frentes carry a $0 stored subtotal because
  // they have no material of their own. Every section that has a material —
  // the PRINCIPAL (when a main exists) and each ALTERNATIVA — revalues those
  // rows against that section's own material price, mirroring how flat
  // GLOBAL additional works appear in every section. `representativeMain` is
  // the price source for the PRINCIPAL section (the first main material, the
  // same representative convention the alternatives use).
  const representativeMain = mainMaterials.length > 0 ? mainMaterials[0] : null;

  const uniqueMainNames = [...new Set(mainMaterials.map((m) => m.name))];
  const mainFabrication: PdfDataRow[] = representativeMain
    ? fabricationCommon.map((f) =>
        revalueGlobalFabricationForMaterial(f, representativeMain, usdRate),
      )
    : [...fabricationCommon];
  for (const name of uniqueMainNames) {
    if (fabricationByMaterial[name]) {
      mainFabrication.push(...fabricationByMaterial[name]);
    }
  }
  const mainPoolRows: PoolPdfRow[] = [...poolsCommon];
  for (const name of uniqueMainNames) {
    if (poolsByMaterial[name]) {
      mainPoolRows.push(...poolsByMaterial[name]);
    }
  }
  const mainAdditional: AdditionalWorkPdfRow[] = representativeMain
    ? addicionalBuckets.additionalCommon.map((a) =>
        revalueGlobalFrenteForMaterial(a, representativeMain, usdRate),
      )
    : [...addicionalBuckets.additionalCommon];
  for (const name of uniqueMainNames) {
    const byMainName = addicionalBuckets.additionalByMaterial[name];
    if (byMainName) {
      mainAdditional.push(
        ...byMainName.map((a) =>
          a.type === 'frente' && a.subtotal_ars === 0 && a.subtotal_usd === 0 && representativeMain
            ? revalueGlobalFrenteForMaterial(a, representativeMain, usdRate)
            : a,
        ),
      );
    }
  }
  const mainAdditionArs = mainAdditional.reduce((s, a) => s + a.subtotal_ars, 0);
  const mainAdditionUsd = mainAdditional.reduce((s, a) => s + a.subtotal_usd, 0);
  let mainSubtotalArs =
    mainMaterialRows.reduce((s, r) => s + r.subtotal_ars, 0) +
    mainPoolRows.reduce((s, r) => s + r.subtotal_ars, 0) +
    mainFabrication.reduce((s, r) => s + r.subtotal_ars, 0) +
    mainAdditionArs;
  let mainSubtotalUsd =
    mainMaterialRows.reduce((s, r) => s + r.subtotal_usd, 0) +
    mainPoolRows.reduce((s, r) => s + r.subtotal_usd, 0) +
    mainFabrication.reduce((s, r) => s + r.subtotal_usd, 0) +
    mainAdditionUsd;
  const mainName = mainMaterials.length === 1 ? mainMaterials[0].name : '';

  // Alternatives — group rows by physical material (catalogue `id`, falling
  // back to the name for legacy rows) so a material with several panes
  // collapses into ONE option section, mirroring the MaterialCard grouping
  // in the form UI. Without this, each `materials_data` row of the same
  // alternative spawned its own "ALTERNATIVA N" section.
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

  if (hasMain) {
    sections.push({
      title: `PRINCIPAL${mainName ? `: ${mainName}` : ''}`,
      is_main: true,
      is_global: false,
      material_name: mainName,
      materials: mainMaterialRows,
      pools: mainPoolRows,
      fabrication_details: mainFabrication,
      additional_works: mainAdditional,
      subtotal_ars: mainSubtotalArs,
      subtotal_usd: mainSubtotalUsd,
    });
    flatMaterials.push(...mainMaterialRows);
    flatPools.push(...mainPoolRows);
    flatFabrication.push(...mainFabrication);
    sections.push(...builtAlternatives);
    for (const a of builtAlternatives) {
      flatMaterials.push(...a.materials);
      flatPools.push(...a.pools);
      flatFabrication.push(...a.fabrication_details);
    }
  } else {
    // No main material. The alternatives below already fold in the common
    // pool / fabrication / additional rows (poolsCommon, additionalCommon,
    // fabricationCommon), so a separate "GLOBAL" section would only
    // duplicate them. Only when there are NO alternatives at all do we need
    // a synthetic GLOBAL section so a pileta marked "no material" or a
    // traforo isn't dropped (no option page would otherwise carry it).
    if (builtAlternatives.length === 0) {
      const globalSubtotalArs =
        mainPoolRows.reduce((s, r) => s + r.subtotal_ars, 0) +
        mainFabrication.reduce((s, r) => s + r.subtotal_ars, 0) +
        mainAdditional.reduce((s, a) => s + a.subtotal_ars, 0);
      const globalSubtotalUsd =
        mainPoolRows.reduce((s, r) => s + r.subtotal_usd, 0) +
        mainFabrication.reduce((s, r) => s + r.subtotal_usd, 0) +
        mainAdditional.reduce((s, a) => s + a.subtotal_usd, 0);
      if (mainPoolRows.length || mainFabrication.length || mainAdditional.length) {
        sections.push({
          title: 'GLOBAL',
          is_main: false,
          is_global: true,
          material_name: '',
          materials: [],
          pools: mainPoolRows,
          fabrication_details: mainFabrication,
          additional_works: mainAdditional,
          subtotal_ars: globalSubtotalArs,
          subtotal_usd: globalSubtotalUsd,
        });
      }
    }
    flatPools.push(...mainPoolRows);
    flatFabrication.push(...mainFabrication);
    sections.push(...builtAlternatives);
    for (const a of builtAlternatives) {
      flatMaterials.push(...a.materials);
      flatPools.push(...a.pools);
      flatFabrication.push(...a.fabrication_details);
    }

    // No main material but at least one alternative: the document-level
    // "principal" subtotal (returned as `subtotalMain`) defaults to the FIRST
    // alternative — the app-wide convention mirrored by `useBudgetCalculations`
    // and `_recalculate_totals_from_items` — i.e. its material cost plus all
    // the common pool / fabrication / additional items.
    if (builtAlternatives.length > 0) {
      mainSubtotalArs = builtAlternatives[0].subtotal_ars;
      mainSubtotalUsd = builtAlternatives[0].subtotal_usd;
    }
  }

  return {
    sections,
    flatMaterials,
    flatPools,
    flatFabrication,
    subtotalMain: mainSubtotalArs,
    subtotalGlobal: 0,
  };
}

// ---------------------------------------------------------------------------
// Public API re-exports — keep `./buildSectionData` as THE import path for
// every consumer (buildPdfData, buildPiecesPdfData, tests).
// ---------------------------------------------------------------------------

export type {
  FabricationRawItem,
  FabricationComparisonItem,
  MeasureInfo,
  SignedMoney,
  AdditionalBuckets,
  SectionsResult,
} from './buildSectionData.types';

export {
  asMaterials,
  asPools,
  buildFabricationRows,
  buildMaterialRows,
  buildPoolRows,
  buildAdditionalWorksRows,
  bucketAdditionalWorks,
} from './buildSectionData.rows';

export {
  revalueGlobalFabricationForMaterial,
  revalueM2FabricationForMaterial,
  revalueGlobalFrenteForMaterial,
  revalueFrenteForMaterial,
} from './buildSectionData.revalue';

export { buildMeasurementComparison } from './buildSectionData.measurement';
export { resolveRenderingPieces } from './buildSectionData.measurement';