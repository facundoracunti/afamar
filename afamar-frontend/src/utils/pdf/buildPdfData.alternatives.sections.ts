/**
 * ALTERNATIVAS → per-option `MaterialSection[]` (the QUOTE OPTIONS GRID
 * source used by the form cards).
 *
 * Split out of `buildPdfData.alternatives.ts` (which stays the public
 * barrel) so each alternative-quoting responsibility lives in its own
 * module:
 *
 *   - `buildPdfData.alternatives.sections` — the per-option sections
 *   - `buildPdfData.alternatives.totals`   — consolidated TOTAL GENERAL
 *                                           ALTERNATIVO per material
 *   - `buildPdfData.alternatives.pieces`   — per-piece / budget blocks
 *   - `buildPdfData.alternatives.options`  — per-option totals (comparativa)
 */

import {
  asMaterials,
  asPools,
  buildAdditionalWorksRows,
  buildFabricationRows,
  bucketAdditionalWorks,
  buildSections,
} from './buildSectionData';
import type { MaterialSection } from './pdfTypes';

/**
 * Build the per-option `MaterialSection[]` for a budget's ALTERNATIVAS,
 * reusing the exact same orchestration as the PDF. Each option section
 * already carries its OWN fully-revalued subtotal (material base + zócalo /
 * frente revalued with that option's material + traforos + pileta) — the
 * ground truth the alternative cards in the form must mirror so they show
 * the same SUBTOTAL the PDF draws.
 */
export function buildAlternativeSections(
  form: Record<string, unknown>,
): { sections: MaterialSection[]; usdRate: number } {
  const allMaterials = asMaterials(form.materials_data);
  const alternatives = allMaterials.filter((m) => m.is_alternative);
  const pools = asPools(form.pools_data);
  const usdRate = Number(form.usd_rate) || 1;
  const fabricationRows = buildFabricationRows(form.fabrication_details, usdRate);
  const additional_works = buildAdditionalWorksRows(form, usdRate);
  const adtBuckets = bucketAdditionalWorks(additional_works);
  const { sections } = buildSections(
    allMaterials,
    alternatives,
    pools,
    fabricationRows,
    usdRate,
    adtBuckets,
  );
  return { sections, usdRate };
}
