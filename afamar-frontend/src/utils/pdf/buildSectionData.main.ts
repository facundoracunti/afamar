/**
 * The PRINCIPAL (main material) section of the PDF document.
 *
 * Split out of `buildSectionData.ts` (which stays the public barrel) so the
 * main-section assembly lives alone, next to the alternatives assembly
 * (`buildSectionData.alternatives.ts`).
 */

import type { MaterialInForm } from '../../types/budget';
import { buildMaterialRows } from './buildSectionData.rows';
import {
  revalueGlobalFabricationForMaterial,
  revalueGlobalFrenteForMaterial,
} from './buildSectionData.revalue';
import type { AdditionalBuckets } from './buildSectionData.types';
import type {
  AdditionalWorkPdfRow,
  MaterialPdfRow,
  PdfDataRow,
  PoolPdfRow,
} from './pdfTypes';

export interface MainSectionInput {
  mainMaterials: MaterialInForm[];
  usdRate: number;
  poolsByMaterial: Record<string, PoolPdfRow[]>;
  poolsCommon: PoolPdfRow[];
  fabricationByMaterial: Record<string, PdfDataRow[]>;
  fabricationCommon: PdfDataRow[];
  addicionalBuckets: AdditionalBuckets;
  useBudgetedMeasures?: boolean;
}

/** Everything the PRINCIPAL section is made of (rows + its subtotal). */
export interface MainSectionData {
  materialRows: MaterialPdfRow[];
  poolRows: PoolPdfRow[];
  fabrication: PdfDataRow[];
  additional: AdditionalWorkPdfRow[];
  subtotalArs: number;
  subtotalUsd: number;
  /** The single main material's name (empty when there are 0 or 2+). */
  name: string;
}

/**
 * Assemble the PRINCIPAL section: the main materials, their piletas, their
 * zócalos / frentes and their additional works, plus its subtotal.
 */
export function buildMainSection({
  mainMaterials,
  usdRate,
  poolsByMaterial,
  poolsCommon,
  fabricationByMaterial,
  fabricationCommon,
  addicionalBuckets,
  useBudgetedMeasures = false,
}: MainSectionInput): MainSectionData {
  const materialRows = buildMaterialRows(mainMaterials, usdRate, useBudgetedMeasures);

  // GLOBAL (unassigned) zócalos / frentes carry a $0 stored subtotal because
  // they have no material of their own. Every section that has a material —
  // the PRINCIPAL (when a main exists) and each ALTERNATIVA — revalues those
  // rows against that section's own material price, mirroring how flat
  // GLOBAL additional works appear in every section. `representativeMain` is
  // the price source for the PRINCIPAL section (the first main material, the
  // same representative convention the alternatives use).
  const representativeMain = mainMaterials.length > 0 ? mainMaterials[0] : null;

  const uniqueMainNames = [...new Set(mainMaterials.map((m) => m.name))];
  const fabrication: PdfDataRow[] = representativeMain
    ? fabricationCommon.map((f) =>
        revalueGlobalFabricationForMaterial(f, representativeMain, usdRate),
      )
    : [...fabricationCommon];
  for (const name of uniqueMainNames) {
    if (fabricationByMaterial[name]) {
      fabrication.push(...fabricationByMaterial[name]);
    }
  }
  const poolRows: PoolPdfRow[] = [...poolsCommon];
  for (const name of uniqueMainNames) {
    if (poolsByMaterial[name]) {
      poolRows.push(...poolsByMaterial[name]);
    }
  }
  const additional: AdditionalWorkPdfRow[] = representativeMain
    ? addicionalBuckets.additionalCommon.map((a) =>
        revalueGlobalFrenteForMaterial(a, representativeMain, usdRate),
      )
    : [...addicionalBuckets.additionalCommon];
  for (const name of uniqueMainNames) {
    const byMainName = addicionalBuckets.additionalByMaterial[name];
    if (byMainName) {
      additional.push(
        ...byMainName.map((a) =>
          a.type === 'frente' && a.subtotal_ars === 0 && a.subtotal_usd === 0 && representativeMain
            ? revalueGlobalFrenteForMaterial(a, representativeMain, usdRate)
            : a,
        ),
      );
    }
  }
  const additionArs = additional.reduce((s, a) => s + a.subtotal_ars, 0);
  const additionUsd = additional.reduce((s, a) => s + a.subtotal_usd, 0);
  const subtotalArs =
    materialRows.reduce((s, r) => s + r.subtotal_ars, 0) +
    poolRows.reduce((s, r) => s + r.subtotal_ars, 0) +
    fabrication.reduce((s, r) => s + r.subtotal_ars, 0) +
    additionArs;
  const subtotalUsd =
    materialRows.reduce((s, r) => s + r.subtotal_usd, 0) +
    poolRows.reduce((s, r) => s + r.subtotal_usd, 0) +
    fabrication.reduce((s, r) => s + r.subtotal_usd, 0) +
    additionUsd;
  const name = mainMaterials.length === 1 ? mainMaterials[0].name : '';

  return {
    materialRows,
    poolRows,
    fabrication,
    additional,
    subtotalArs,
    subtotalUsd,
    name,
  };
}
