/**
 * Entity form helpers — list adders and re-export hub.
 *
 * Split into focused modules:
 * - entityFormConstants.ts — M2_CONCEPTS, CUTOUT_DETAILS, DEFAULT_FINANCIALS, INITIAL_FORM
 * - entityFormFinancial.ts — buildFinancialPayload, mapFinancialToForm
 * - entityFormSerialization.ts — buildPayload, mapApiToForm, sketch page serialize/unflatten
 */

import type { EntityFormState, Pool } from '../types';
import type { Material } from '../types/material';
import type { Client, ClientAddress } from '../types/client';
import type { AdditionalWork } from '../types/additionalWork';
import { POOL_MATERIAL_GLOBAL, type FabricationDetail, type MaterialInForm, type PoolInForm } from '../types/budget';
import {
  FRENTE_FORMULA_MULTIPLIER_DEFAULT,
  computeFrenteTotal,
  resolveFrenteMultiplier,
} from '../utils/frentePricing';
import { INITIAL_FORM, M2_CONCEPTS, CUTOUT_DETAILS, DEFAULT_FINANCIALS } from './entityFormConstants';
import { buildFinancialPayload, mapFinancialToForm } from './entityFormFinancial';
import { buildPayload, mapApiToForm, todayLocalISO } from './entityFormSerialization';

export { M2_CONCEPTS, CUTOUT_DETAILS, DEFAULT_FINANCIALS, INITIAL_FORM };
export { buildFinancialPayload, mapFinancialToForm };
export { buildPayload, mapApiToForm, todayLocalISO };

function defaultPoolMaterial(form: EntityFormState): string {
  const materials = form.materials_data || [];
  const firstMain = materials.find((m) => !m.is_alternative);
  if (firstMain) return firstMain.name;
  return POOL_MATERIAL_GLOBAL;
}

export function addMaterialToList(
  form: EntityFormState,
  materials: Material[],
  name: string
): MaterialInForm[] | null {
  if (!name) return null;
  const mat = materials.find((m) => m.name === name);
  if (!mat) return null;
  const current = form.materials_data || [];
  return [
    ...current,
    {
      id: mat.id,
      name: mat.name,
      category: mat.category_id ? String(mat.category_id) : '',
      color: mat.color || '',
      price_m2: mat.base_price || 0,
      price_m2_usd: mat.price_usd || 0,
      currency: mat.currency || 'ARS',
      quantity: 1,
      m2_used: 0,
      m2_budgeted: 0,
      length: 0,
      width: 0,
      is_alternative: false,
      allows_integrated_sink: mat.allows_integrated_sink ?? true,
    },
  ];
}

/** Add another measurement row for an already-selected material, keeping
 *  the card grouping (one card per material, N panes inside) without
 *  touching the flat `materials_data` contract. The new row inherits the
 *  material's identity/prices/currency/alternative flag and starts with
 *  blank dimensions (1 × 0m × 0m). */
export function addMaterialRowToList(
  form: EntityFormState,
  mat: MaterialInForm
): MaterialInForm[] | null {
  if (!mat || !mat.name) return null;
  const current = form.materials_data || [];
  return [
    ...current,
    {
      ...mat,
      quantity: 1,
      m2_used: 0,
      m2_budgeted: 0,
      length: 0,
      width: 0,
    },
  ];
}

/** Replace the catalogue identity (name/color/prices/currency/category)
 *  of every row whose global index is in `idxs` (a whole card), keeping
 *  each row's measurements (length × width × quantity) and the
 *  alternative flag intact — the MaterialCard "Cambiar material" picker
 *  swaps the card without losing the dimensions already entered. */
export function swapMaterialGroupToList(
  form: EntityFormState,
  idxs: number[],
  mat: Material,
): MaterialInForm[] | null {
  if (!mat || !mat.name) return null;
  const current = form.materials_data || [];
  const indexSet = new Set(idxs);
  return current.map((row, i) => {
    if (!indexSet.has(i)) return row;
    return {
      ...row,
      id: mat.id,
      name: mat.name,
      category: mat.category_id ? String(mat.category_id) : '',
      color: mat.color || '',
      price_m2: mat.base_price || 0,
      price_m2_usd: mat.price_usd || 0,
      currency: mat.currency || 'ARS',
      allows_integrated_sink: mat.allows_integrated_sink ?? true,
    };
  });
}

/** Result of `repointSwapReferences`: the three arrays that hold material
 *  links, re-pointed from the swapped group's old names to `newName`. */
export interface SwapReferenceResult {
  pools_data: PoolInForm[];
  fabrication_details: FabricationDetail[];
  additional_works_data: string | null;
}

function parseAdditionalWorksRaw(json: string | null | undefined): Array<Record<string, unknown>> {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object');
  } catch {
    return [];
  }
}

/** Re-price payload for the rows re-pointed by a MaterialCard
 *  "Cambiar material" swap. When provided, every repointed `frente` row
 *  (additional_works_data) is recomputed against the NEW material's price
 *  (the old snapshot's `price`/`total`/`currency`/`formula_values` would
 *  otherwise stay frozen at the previous material's values), and every
 *  repointed M² fabrication row (BASEBOARD/FRONT zócalos & frentes) gets
 *  its `price` reprinted as `m2 × price_m²` in the new material's currency
 *  — the budget 81 regression. Flat rows are still never repriced. */
export interface SwapRepriceOptions {
  mat: Pick<Material, 'id' | 'name' | 'base_price' | 'price_usd' | 'currency'>;
  /** Catalogue such that the frente's formula multiplier can be resolved
   *  exactly (mirrors `recomputeFrenteRow`). Falls back to the row's own
   *  frozen `formula_values.multiplier`, then to 1.15. */
  catalogueById?: Map<number, AdditionalWork>;
}

/** Re-point every material link (pools by name, fabrication rows by name,
 *  additional-work rows by `materialName` / `material_name`, honouring the
 *  `__ALT__:` alternative prefix) that referenced one of `oldNames` to
 *  `newName`. `POOL_MATERIAL_GLOBAL` and empty links are left untouched.
 *
 *  When `reprice` is given, `frente` rows that were re-pointed are ALSO
 *  recomputed against the new material (price/total/currency/
 *  `assigned_material_id`/`formula_values`), and M² fabrication rows
 *  (zócalos/frentes) re-pointed to the new material get `price` reprinted
 *  as `m2 × price_m²` in the material's currency — the whole point of the
 *  "Cambiar material" card swap is that what's attached to the card follows
 *  it to the new material INCLUDING its price.
 *
 *  Used by the MaterialCard "Cambiar material" swap so attached pools,
 *  fabrication and frentes follow the card to its new material instead of
 *  being orphaned (and silently dropped from the PDF sections). */
export function repointSwapReferences(
  form: EntityFormState,
  oldNames: Set<string>,
  newName: string,
  reprice?: SwapRepriceOptions,
): SwapReferenceResult {
  const pools_data = (form.pools_data || []).map((pool) => {
    if (pool.material && pool.material !== POOL_MATERIAL_GLOBAL && oldNames.has(pool.material)) {
      return { ...pool, material: newName };
    }
    return pool;
  });

  const fabrication_details = (form.fabrication_details || []).map((detail) => {
    if (detail.material && oldNames.has(detail.material)) {
      if (reprice && M2_CONCEPTS.includes(detail.concept)) {
        const m2 =
          Number(detail.m2 || 0) > 0
            ? Number(detail.m2)
            : Math.round(Number(detail.length || 0) * Number(detail.width || 0) * Number(detail.quantity || 1) * 100000) / 100000;
        if (m2 > 0) {
          const currency = reprice.mat.currency || 'ARS';
          const pm2 = currency === 'USD' ? Number(reprice.mat.price_usd || 0) : Number(reprice.mat.base_price || 0);
          return {
            ...detail,
            material: newName,
            currency,
            material_price_m2: pm2,
            m2,
            price: Math.round(m2 * pm2 * 100) / 100,
          };
        }
      }
      return { ...detail, material: newName };
    }
    return detail;
  });

  const rawJson = form.additional_works_data;
  let changed = false;
  const additional_works_data = JSON.stringify(
    parseAdditionalWorksRaw(rawJson).map((row) => {
      const raw = typeof row.materialName === 'string'
        ? row.materialName
        : typeof row.material_name === 'string'
          ? row.material_name
          : '';
      if (!raw || raw === POOL_MATERIAL_GLOBAL) return row;
      const isAlt = raw.startsWith('__ALT__:');
      const base = isAlt ? raw.slice('__ALT__:'.length) : raw;
      if (!oldNames.has(base)) return row;
      const nextName = (isAlt ? '__ALT__:' : '') + newName;
      changed = true;
      if (reprice && row.type === 'frente') {
        return repriceSwappedFrente(row, isAlt, newName, reprice);
      }
      if (typeof row.materialName === 'string') return { ...row, materialName: nextName };
      return { ...row, material_name: nextName };
    }),
  );

  return {
    pools_data,
    fabrication_details,
    additional_works_data: changed ? additional_works_data : (rawJson ?? null),
  };
}

/** Recompute a `frente` row that just followed a swapped material card to
 *  its new material. The row was already re-pointed (`materialName`), so
 *  this updates the price snapshot that `buildFrenteSelectionFor` /
 *  `recomputeFrenteRow` froze at selection time. Formula:
 *      price/ml = price_m² × 0.13 × multiplier;  total = price/ml × ml
 *  Multiplier resolution order mirrors the picker: catalogue row first,
 *  then the row's own frozen `formula_values.multiplier`, then 1.15. */
function repriceSwappedFrente(
  row: Record<string, unknown>,
  isAlt: boolean,
  newName: string,
  options: SwapRepriceOptions,
): Record<string, unknown> {
  const { mat, catalogueById } = options;
  const catalogueRow = catalogueById?.get(Number(row.additional_work_id));
  const stored = (row.formula_values as { multiplier?: unknown } | null | undefined)?.multiplier;
  const storedMultiplier = Number(stored);
  const multiplier = catalogueRow
    ? resolveFrenteMultiplier(catalogueRow)
    : Number.isFinite(storedMultiplier) && storedMultiplier > 0
      ? storedMultiplier
      : FRENTE_FORMULA_MULTIPLIER_DEFAULT;
  const pricePerM2 = mat.currency === 'USD' ? Number(mat.price_usd || 0) : Number(mat.base_price || 0);
  const computed = computeFrenteTotal(pricePerM2, multiplier, Number(row.linear_meters || 0));
  return {
    ...row,
    materialName: (isAlt ? '__ALT__:' : '') + newName,
    assigned_material_id: mat.id,
    price: computed.price_per_meter,
    total: computed.total,
    currency: mat.currency,
    formula_values: {
      material_price_m2_at_selection: pricePerM2,
      multiplier,
      computed_at: new Date().toISOString(),
    },
  };
}

export function addPoolToList(  form: EntityFormState,
  pools: Pool[],
  pid: string
): PoolInForm[] | null {
  if (!pid) return null;
  const pt = pools.find((p) => p.id === Number(pid));
  if (!pt) return null;
  const current = form.pools_data || [];
  return [
    ...current,
    {
      pool_id: pt.id,
      brand: pt.brand,
      model: pt.model,
      price: pt.price || 0,
      currency: 'ARS' as const,
      image: '',
      quantity: 1,
      material: defaultPoolMaterial(form),
    },
  ];
}

export function createAddressAddedHandler(
  clientes: unknown[],
  updateClientAddresses: (clientId: number, addresses: ClientAddress[]) => void,
) {
  return (clientId: number, address: ClientAddress) => {
    const client = (clientes as Client[]).find((c) => c.id === clientId);
    if (client) {
      updateClientAddresses(clientId, [...(client.addresses || []), address]);
    }
  };
}
