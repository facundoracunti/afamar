/**
 * Entity form helpers — list adders and re-export hub.
 *
 * Split into focused modules:
 * - entityFormConstants.ts — M2_CONCEPTS, CUTOUT_DETAILS, DEFAULT_FINANCIALS, INITIAL_FORM
 * - entityFormFinancial.ts — buildFinancialPayload, mapFinancialToForm
 * - entityFormSerialization.ts — buildPayload, mapApiToForm, sketch flatten/unflatten
 */

import type { EntityFormState, Pool } from '../types';
import type { Material } from '../types/material';
import type { Client, ClientAddress } from '../types/client';
import { POOL_MATERIAL_GLOBAL, type FabricationDetail, type MaterialInForm, type PoolInForm } from '../types/budget';
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

/** Re-point every material link (pools by name, fabrication rows by name,
 *  additional-work rows by `materialName` / `material_name`, honouring the
 *  `__ALT__:` alternative prefix) that referenced one of `oldNames` to
 *  `newName`. `POOL_MATERIAL_GLOBAL` and empty links are left untouched.
 *
 *  Used by the MaterialCard "Cambiar material" swap so attached pools,
 *  fabrication and frentes follow the card to its new material instead of
 *  being orphaned (and silently dropped from the PDF sections). */
export function repointSwapReferences(
  form: EntityFormState,
  oldNames: Set<string>,
  newName: string,
): SwapReferenceResult {
  const pools_data = (form.pools_data || []).map((pool) => {
    if (pool.material && pool.material !== POOL_MATERIAL_GLOBAL && oldNames.has(pool.material)) {
      return { ...pool, material: newName };
    }
    return pool;
  });

  const fabrication_details = (form.fabrication_details || []).map((detail) => {
    if (detail.material && oldNames.has(detail.material)) {
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
