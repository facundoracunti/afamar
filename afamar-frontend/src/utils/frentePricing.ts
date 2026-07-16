import { AdditionalWork } from '../types/additionalWork';
import { MaterialInForm } from '../types/budget';
import { round2 } from './math';

/** Re-export the group option type so existing call sites don't need
 *  to import from `./materialGroups` separately. The helper exists in
 *  `utils/materialGroups.ts` for future use; today this file doesn't
 *  consume it to keep parity with the original working picker (which
 *  showed each `materials_data` row individually). */

/** Constants mirror the backend `app.services.frente_pricing`. Centralised
 *  here so the picker preview agrees with the persisted value. */
export const FRENTE_LINEAR_COEFFICIENT = 0.13;
export const FRENTE_FORMULA_MULTIPLIER_DEFAULT = 1.15;

function rowBasePrice(m: MaterialInForm, currency: 'ARS' | 'USD'): number {
  return currency === 'USD' ? Number(m.price_m2_usd ?? 0) : Number(m.price_m2 ?? 0);
}

/** Backwards-compatible shape used by `AdditionalWorkCard` and the
 *  `useAdditionalWorkSelection` hook. Each entry corresponds to one
 *  `materials_data` row in the form's snapshot (kept flat — the
 *  historical contract that pre-dates the dedup helper). */
export interface FrenteMaterialOption {
  /** Catalogue row id when the snapshot row is identifiable by id;
   *  otherwise `null` for legacy rows that fall back to a name-based
   *  lookup in the backend. */
  id: number | null;
  name: string;
  /** Per-m² price in the material's currency. */
  price_per_m2: number;
  currency: 'ARS' | 'USD';
  is_alternative: boolean;
}

export interface MaterialOptionListInput {
  materials?: MaterialInForm[] | null;
  catalogueMaterials?: Array<{ id: number; name: string; base_price?: number; price_usd?: number; currency?: string }> | null;
}

/** Flatten the form's `materials_data` snapshot into the option list the
 *  picker wants to show.
 *
 *  Strategy for the `id` field:
 *    1. Prefer the snapshot row's own `id` (set when the operator
 *       added the material from the dropdown — see
 *       `addMaterialToList` in `entityFormHelpers`).
 *    2. Fall back to the catalogue lookup by name so legacy rows that
 *       pre-date the addition of `id` to MaterialInForm still get a
 *       real FK to the backend.
 *    3. Final fallback: `null` — the backend's `apply_frente_rows` keeps
 *       the row at price * quantity.
 */
export function buildFrenteMaterialOptions({
  materials,
  catalogueMaterials,
}: MaterialOptionListInput): FrenteMaterialOption[] {
  if (!materials || !materials.length) return [];
  const catalogueByName = new Map(
    (catalogueMaterials || [])
      .filter((c) => c && c.name)
      .map((c) => [c.name as string, c]),
  );
  return materials
    .filter((m) => m && m.name)
    .map((m) => {
      const cat = catalogueByName.get(m.name);
      const priceUsd = cat?.price_usd ?? m.price_m2_usd ?? 0;
      const priceArs = cat?.base_price ?? m.price_m2 ?? 0;
      const currency: 'ARS' | 'USD' = m.currency === 'USD' ? 'USD' : 'ARS';
      const id = (m.id && Number.isFinite(m.id)) ? m.id : (cat?.id ?? null);
      return {
        id,
        name: m.name,
        price_per_m2: currency === 'USD' ? priceUsd : priceArs,
        currency,
        is_alternative: !!m.is_alternative,
      };
    });
}

/** Resolve the formula multiplier for a catalogue row (defaults to
 *  1.15 if the catalogue row omitted it). The DB column is still
 *  `formula_constant` for migration history; the value is a
 *  multiplier, not an additive constant. */
export function resolveFrenteMultiplier(
  catalogue: AdditionalWork | null | undefined,
): number {
  if (!catalogue) return FRENTE_FORMULA_MULTIPLIER_DEFAULT;
  const v = catalogue.formula_constant;
  if (v === null || v === undefined || Number.isNaN(Number(v))) {
    return FRENTE_FORMULA_MULTIPLIER_DEFAULT;
  }
  return Number(v);
}

/** Run the formula. Returns frozen `{price_per_meter, total}` in the
 *  material's currency (2dp).
 *
 *  Multiplicative per the business rule:
 *      price/ml = price_m² × 0.13 × multiplier
 *      total    = price_m² × 0.13 × multiplier × linear_meters
 *
 *  Both values are rounded to 2dp. */
export function computeFrenteTotal(
  materialPricePerM2: number,
  formulaMultiplier: number,
  linearMeters: number,
): { price_per_meter: number; total: number } {
  const multiplier = Number(formulaMultiplier || 0);
  const basePrice = Number(materialPricePerM2 || 0);
  const ml = Number(linearMeters || 0);
  const pricePerMeter = round2(basePrice * FRENTE_LINEAR_COEFFICIENT * multiplier);
  const total = round2(basePrice * FRENTE_LINEAR_COEFFICIENT * multiplier * ml);
  return { price_per_meter: pricePerMeter, total };
}

/**
 * Build a fresh `Frente / Regrueso` row pre-assigned to a given material.
 *
 * Used by the per-row "+ Frente / Regrueso" picker in
 * `AdditionalWorkSection` to skip the multi-step picker dance. The
 * operator picks a material from a dropdown; the new card appears in
 * the TRABAJO ADICIONAL section with `assigned_material_id` already
 * set to the catalogue row id (or `null` for legacy snapshots where
 * the id wasn't captured — the backend then falls back to a name
 * lookup).
 *
 * The price/total/currency are filled in once the formula recalculates
 * against the (id, multiplier, linear_meters) tuple — we don't
 * pre-compute them here to avoid drift between the helper and the
 * backend's `compute_frente_subtotal`.
 */
export function buildFrenteSelectionFor(
  catalogueRow: Pick<AdditionalWork, 'id' | 'name' | 'detail' | 'currency'>,
  material: {
    id?: number | null;
    name: string;
    price_per_m2: number;
    currency: 'ARS' | 'USD';
    is_alternative: boolean;
  },
  multiplier: number,
): {
  additional_work_id: number;
  name: string;
  detail: string | null;
  price: number;
  currency: 'ARS' | 'USD';
  quantity: number;
  total: number;
  materialName: string;
  type: 'frente';
  linear_meters: number;
  assigned_material_id: number | null;
  formula_values: null;
} {
  const computed = computeFrenteTotal(material.price_per_m2, multiplier, 1);
  return {
    additional_work_id: catalogueRow.id,
    name: catalogueRow.name,
    detail: catalogueRow.detail ?? null,
    price: computed.price_per_meter,
    currency: material.currency,
    quantity: 1,
    total: computed.total,
    // Reuse the legacy `materialName` field as the cross-reference —
    // it's what the flat-row picker uses to bucket the subtotal into
    // the right section of the Presupuesto card. For alternativas we
    // prefix with `__ALT__:` so the per-option subtotal bucketing
    // distinguishes principal vs alternativa totals.
    materialName: material.is_alternative ? `__ALT__:${material.name}` : material.name,
    type: 'frente',
    linear_meters: 1,
    assigned_material_id: material.id ?? null,
    formula_values: null,
  };
}
