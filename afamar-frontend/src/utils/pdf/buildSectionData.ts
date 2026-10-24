/**
 * PDF section-data builders — PUBLIC BARREL.
 *
 * Row transformation, revaluation, COMPARATIVA DE MEDICIÓN and per-option
 * section bucketing.
 *
 * The implementations live in the secondary modules (same folder):
 *
 *   - `buildSectionData.rows`        — raw form slices → PDF rows
 *   - `buildSectionData.revalue`     — global zócalo/frente revaluation
 *   - `buildSectionData.measurement` — COMPARATIVA DE MEDICIÓN rows
 *   - `buildSectionData.groups`      — bucket rows by linked material
 *   - `buildSectionData.main`        — the PRINCIPAL section
 *   - `buildSectionData.alternatives`— the ALTERNATIVA sections
 *   - `buildSectionData.sections`    — the `buildSections` orchestrator
 *
 * This file stays THE import path for every consumer (buildPdfData,
 * buildPiecesPdfData, tests): the public names and their shapes are
 * unchanged.
 */

export { buildSections } from './buildSectionData.sections';

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
