/**
 * Shared types for the PDF section-data builders
 * (`buildSectionData` and its secondary modules).
 *
 * These shapes were previously declared inline inside `buildSectionData.ts`;
 * they only describe the raw inputs and intermediate values the row builders
 * and comparison logic consume/produce — the rendered row documents live in
 * `./pdfTypes`.
 */

import type {
  AdditionalWorkPdfRow,
  MaterialPdfRow,
  MaterialSection,
  PdfDataRow,
  PoolPdfRow,
} from './pdfTypes';

/** Raw row shape accepted by `buildFabricationRows`. */
export interface FabricationRawItem {
  concept?: string;
  custom_concept?: string;
  length?: number;
  width?: number;
  quantity?: number;
  price?: number;
  currency?: string;
  detail?: string;
  material?: string;
  labor?: number;
}

/** Raw fabrication row shape consumed by `buildMeasurementComparison`. */
export interface FabricationComparisonItem {
  concept?: string;
  concepto?: string;
  custom_concept?: string;
  detail?: string;
  currency?: string;
  price?: number;
  quantity?: number;
  length?: number;
  width?: number;
  material?: string;
  m2_budgeted?: number | null;
  linear_meters_budgeted?: number | null;
  total_ars_budgeted?: number | null;
  total_usd_budgeted?: number | null;
}

/** Non-unit-aware measure snapshot passed to `detailRow`. */
export interface MeasureInfo {
  unit: 'm2' | 'ml' | null;
  real: number | null;
  budgeted: number | null;
  delta: number | null;
}

/** Signed-money formatter (e.g. `+$ 1.000,00`). */
export type SignedMoney = (v: number) => string;

/** Additional-works buckets produced by `bucketAdditionalWorks`. */
export interface AdditionalBuckets {
  additionalByMaterial: Record<string, AdditionalWorkPdfRow[]>;
  additionalCommon: AdditionalWorkPdfRow[];
}

/** Aggregated result of `buildSections`. */
export interface SectionsResult {
  sections: MaterialSection[];
  flatMaterials: MaterialPdfRow[];
  flatPools: PoolPdfRow[];
  flatFabrication: PdfDataRow[];
  subtotalMain: number;
  subtotalGlobal: number;
}