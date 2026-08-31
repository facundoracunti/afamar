import { describe, expect, it } from 'vitest';
import { applyAdditionalWorkField } from './additionalWorkCalc';
import { POOL_MATERIAL_GLOBAL } from '../types/budget';
import type { AdditionalWork } from '../types/additionalWork';
import type { AdditionalWorkSelection } from './additionalWorkParse';

const frenteRow: AdditionalWorkSelection = {
  additional_work_id: 6,
  name: 'Frente Ingletetado 45',
  detail: 'Frente 45',
  price: 0,
  currency: 'ARS',
  quantity: 1,
  total: 0,
  materialName: POOL_MATERIAL_GLOBAL,
  type: 'frente',
  linear_meters: 3.3,
  assigned_material_id: null as number | null,
  formula_values: null,
};

const catalogue: AdditionalWork = {
  id: 6,
  name: 'Frente Ingletetado 45',
  detail: 'Frente 45',
  type: 'frente',
  formula_constant: 1.15,
  price: 0,
  currency: 'USD',
} as AdditionalWork;

const materialOptions = [
  { id: 27, name: 'ZIRCONIUM', price_per_m2: 750, currency: 'USD' as const, is_alternative: true },
];

describe('applyAdditionalWorkField — frente GLOBAL', () => {
  it('selecting GLOBAL - SUMA AL TOTAL clears the assigned material, price and marks the row global', () => {
    const out = applyAdditionalWorkField(
      { ...frenteRow, assigned_material_id: 27, materialName: '__ALT__:ZIRCONIUM', price: 100, total: 330 },
      'assigned_material_id',
      POOL_MATERIAL_GLOBAL,
      { catalogueItem: catalogue, materialOptions },
    );
    expect(out.assigned_material_id).toBeNull();
    expect(out.materialName).toBe(POOL_MATERIAL_GLOBAL);
    expect(out.price).toBe(0);
    expect(out.total).toBe(0);
  });

  it('auto-assigns a material and tags the alternative prefix on materialName', () => {
    const out = applyAdditionalWorkField(
      { ...frenteRow },
      'assigned_material_id',
      '27',
      { catalogueItem: catalogue, materialOptions },
    );
    expect(out.assigned_material_id).toBe(27);
    expect(out.materialName).toBe('__ALT__:ZIRCONIUM');
    // price/ml = 750 × 0.13 × 1.15 ≈ 112.12 ; total = × 3.3 ≈ 370.01
    expect(out.price).toBeCloseTo(112.12);
    expect(out.total).toBeCloseTo(370.01);
    expect(out.currency).toBe('USD');
  });
});
