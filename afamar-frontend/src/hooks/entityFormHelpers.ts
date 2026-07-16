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
import { POOL_MATERIAL_GLOBAL, type MaterialInForm, type PoolInForm } from '../types/budget';
import { INITIAL_FORM, M2_CONCEPTS, CUTOUT_DETAILS, DEFAULT_FINANCIALS } from './entityFormConstants';
import { buildFinancialPayload, mapFinancialToForm } from './entityFormFinancial';
import { buildPayload, mapApiToForm, todayLocalISO } from './entityFormSerialization';

export { M2_CONCEPTS, CUTOUT_DETAILS, DEFAULT_FINANCIALS, INITIAL_FORM };
export { buildFinancialPayload, mapFinancialToForm };
export { buildPayload, mapApiToForm, todayLocalISO };

function defaultPoolMaterial(form: EntityFormState): string {
  const materials = (form.materials_data as unknown as MaterialInForm[]) || [];
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
  const current = (form.materials_data as unknown as MaterialInForm[]) || [];
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
    } as unknown as MaterialInForm,
  ];
}

export function addPoolToList(
  form: EntityFormState,
  pools: Pool[],
  pid: string
): PoolInForm[] | null {
  if (!pid) return null;
  const pt = pools.find((p) => p.id === Number(pid));
  if (!pt) return null;
  const current = (form.pools_data as unknown as PoolInForm[]) || [];
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
    } as unknown as PoolInForm,
  ];
}
