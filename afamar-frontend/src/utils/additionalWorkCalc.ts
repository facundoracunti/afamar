import type { FrenteMaterialOption } from './frentePricing';
import type { AdditionalWork } from '../types/additionalWork';
import { computeFrenteTotal, resolveFrenteMultiplier } from './frentePricing';
import { POOL_MATERIAL_GLOBAL } from '../types/budget';
import type { AdditionalWorkSelection as ParseAdditionalWorkSelection } from './additionalWorkParse';

export function recomputeFrenteRow(
  row: ParseAdditionalWorkSelection,
  catalogueItem: AdditionalWork | null | undefined,
  materialOptions: FrenteMaterialOption[] | undefined,
): ParseAdditionalWorkSelection {
  const updated = { ...row };
  if (
    updated.type === 'frente' &&
    catalogueItem &&
    materialOptions &&
    updated.assigned_material_id != null
  ) {
    const matOpt = materialOptions.find((m) => m.id === updated.assigned_material_id);
    const multiplier = resolveFrenteMultiplier(catalogueItem);
    const computed = computeFrenteTotal(
      matOpt?.price_per_m2 ?? 0,
      multiplier,
      Number(updated.linear_meters || 0),
    );
    updated.price = computed.price_per_meter;
    updated.total = computed.total;
    updated.currency = matOpt?.currency ?? updated.currency;
    updated.formula_values = {
      material_price_m2_at_selection: matOpt?.price_per_m2 ?? 0,
      multiplier,
      computed_at: new Date().toISOString(),
    };
  } else if (updated.assigned_material_id == null) {
    updated.price = 0;
    updated.total = 0;
    updated.formula_values = null;
  }
  return updated;
}

interface UpdateFieldOptions {
  catalogueItem?: AdditionalWork | null;
  materialOptions?: FrenteMaterialOption[];
}

export function applyAdditionalWorkField(
  row: ParseAdditionalWorkSelection,
  field: string,
  value: unknown,
  _options?: UpdateFieldOptions,
): ParseAdditionalWorkSelection {
  const updated = { ...row };
  if (field === 'price') {
    updated.price = Number(value) || 0;
    if (updated.type !== 'frente') {
      updated.total = Math.round((updated.price * updated.quantity) * 100) / 100;
    }
  } else if (field === 'quantity') {
    updated.quantity = Number(value) || 1;
    if (updated.type !== 'frente') {
      updated.total = Math.round((updated.price * updated.quantity) * 100) / 100;
    }
  } else if (field === 'materialName') {
    updated.materialName = String(value ?? POOL_MATERIAL_GLOBAL);
  } else if (field === 'linear_meters') {
    updated.linear_meters = Math.max(0, Number(value) || 0);
    return recomputeFrenteRow(updated, _options?.catalogueItem, _options?.materialOptions);
  } else if (field === 'assigned_material_id') {
    if (value === null || value === undefined || value === '') {
      updated.assigned_material_id = null;
    } else {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && _options?.materialOptions?.some((m) => m.id === numeric)) {
        updated.assigned_material_id = numeric;
      } else {
        (updated as Record<string, unknown>).assigned_material_name = String(value);
        updated.assigned_material_id = null;
      }
    }
    return recomputeFrenteRow(updated, _options?.catalogueItem, _options?.materialOptions);
  }
  return updated;
}
