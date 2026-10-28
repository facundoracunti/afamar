/**
 * Group materials, pools and fabrication details into per-option sections.
 *
 * Split out of `buildSectionData.ts` (which stays the public barrel) so the
 * flagship `buildSections` orchestrator lives next to the pieces it
 * composes:
 *
 *   - `buildSectionData.groups`      — bucket rows by linked material
 *   - `buildSectionData.main`        — the PRINCIPAL section
 *   - `buildSectionData.alternatives`— the ALTERNATIVA sections
 */

import type { MaterialInForm, PoolInForm } from '../../types/budget';
import { buildPoolRows } from './buildSectionData.rows';
import { groupFabricationRows, groupPoolRows } from './buildSectionData.groups';
import { buildMainSection } from './buildSectionData.main';
import { buildAlternativeSections } from './buildSectionData.alternatives';
import type { AdditionalBuckets, SectionsResult } from './buildSectionData.types';
import type {
  MaterialPdfRow,
  MaterialSection,
  PdfDataRow,
  PoolPdfRow,
} from './pdfTypes';

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
  useBudgetedMeasures = false,
): SectionsResult {
  const mainMaterials = allMaterials.filter((m) => !m.is_alternative);
  const flatMaterials: MaterialPdfRow[] = [];
  const flatPools: PoolPdfRow[] = [];
  const flatFabrication: PdfDataRow[] = [];
  const sections: MaterialSection[] = [];

  const poolGroups = groupPoolRows(buildPoolRows(pools, usdRate));
  const fabricationGroups = groupFabricationRows(fabricationRows);

  const main = buildMainSection({
    mainMaterials,
    usdRate,
    poolsByMaterial: poolGroups.poolsByMaterial,
    poolsCommon: poolGroups.poolsCommon,
    fabricationByMaterial: fabricationGroups.fabricationByMaterial,
    fabricationCommon: fabricationGroups.fabricationCommon,
    addicionalBuckets,
    useBudgetedMeasures,
  });

  const builtAlternatives = buildAlternativeSections({
    alternatives,
    usdRate,
    poolsByMaterial: poolGroups.poolsByMaterial,
    poolsCommon: poolGroups.poolsCommon,
    fabricationByMaterial: fabricationGroups.fabricationByMaterial,
    fabricationCommon: fabricationGroups.fabricationCommon,
    addicionalBuckets,
    useBudgetedMeasures,
  });

  // Main section
  const hasMain = mainMaterials.length > 0;
  let mainSubtotalArs = main.subtotalArs;
  let mainSubtotalUsd = main.subtotalUsd;

  if (hasMain) {
    sections.push({
      title: `PRINCIPAL${main.name ? `: ${main.name}` : ''}`,
      is_main: true,
      is_global: false,
      material_name: main.name,
      materials: main.materialRows,
      pools: main.poolRows,
      fabrication_details: main.fabrication,
      additional_works: main.additional,
      subtotal_ars: mainSubtotalArs,
      subtotal_usd: mainSubtotalUsd,
    });
    flatMaterials.push(...main.materialRows);
    flatPools.push(...main.poolRows);
    flatFabrication.push(...main.fabrication);
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
        main.poolRows.reduce((s, r) => s + r.subtotal_ars, 0) +
        main.fabrication.reduce((s, r) => s + r.subtotal_ars, 0) +
        main.additional.reduce((s, a) => s + a.subtotal_ars, 0);
      const globalSubtotalUsd =
        main.poolRows.reduce((s, r) => s + r.subtotal_usd, 0) +
        main.fabrication.reduce((s, r) => s + r.subtotal_usd, 0) +
        main.additional.reduce((s, a) => s + a.subtotal_usd, 0);
      if (main.poolRows.length || main.fabrication.length || main.additional.length) {
        sections.push({
          title: 'GLOBAL',
          is_main: false,
          is_global: true,
          material_name: '',
          materials: [],
          pools: main.poolRows,
          fabrication_details: main.fabrication,
          additional_works: main.additional,
          subtotal_ars: globalSubtotalArs,
          subtotal_usd: globalSubtotalUsd,
        });
      }
    }
    flatPools.push(...main.poolRows);
    flatFabrication.push(...main.fabrication);
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
