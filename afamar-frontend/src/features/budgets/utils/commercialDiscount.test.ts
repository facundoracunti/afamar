/**
 * Fase 3 — Descuento Comercial: `computeCommercialDiscount` +
 * `computeMaterialsSubtotal`. Mirrors the inline blocks of
 * `useBudgetCalculations` and `buildPdfData`.
 */

import type { MaterialInForm } from '@/types/budget';
import { describe, expect, it } from 'vitest';
import { computeCommercialDiscount, computeMaterialsSubtotal } from './commercialDiscount';

function material(
  overrides: Partial<MaterialInForm> = {},
): MaterialInForm {
  return {
    id: 1,
    name: 'NEGRO BRASIL',
    price_m2: 0,
    price_m2_usd: 0,
    currency: 'ARS',
    quantity: 1,
    length: 1,
    width: 1,
    m2_used: 0,
    m2_budgeted: 0,
    is_alternative: false,
    ...overrides,
  } as MaterialInForm;
}

describe('computeMaterialsSubtotal', () => {
  it('sums main ARS + USD materials in both currencies', () => {
    const materials = [
      material({ id: 1, currency: 'ARS', length: 2, width: 1, quantity: 1, price_m2: 50000 }),
      material({ id: 2, currency: 'USD', length: 2, width: 1, quantity: 1, price_m2_usd: 100 }),
    ];
    const r = computeMaterialsSubtotal(materials, 1000);
    // ARS: 2*1*50000 = 100000 + 200 USD * 1000 = 300000
    expect(r.materialsSubtotalArs).toBe(300000);
    // USD: 200 + 100000/1000 = 300
    expect(r.materialsSubtotalUsd).toBe(300);
  });

  it('excludes alternative materials from the subtotal', () => {
    const materials = [
      material({ id: 1, currency: 'ARS', length: 2, width: 1, price_m2: 50000 }),
      material({ id: 2, is_alternative: true, currency: 'ARS', length: 9, width: 9, price_m2: 999999 }),
    ];
    const r = computeMaterialsSubtotal(materials, 1000);
    expect(r.materialsSubtotalArs).toBe(100000);
  });
});

describe('computeCommercialDiscount', () => {
  const base = {
    enabled: true,
    percentage: 10,
    target: 'total' as const,
    totalBaseArs: 11000,
    totalBaseUsd: 11,
    materialsSubtotalArs: 6000,
    materialsSubtotalUsd: 6,
  };

  it('is inactive when disabled or percentage is 0', () => {
    expect(computeCommercialDiscount({ ...base, enabled: false }).active).toBe(false);
    const zero = computeCommercialDiscount({ ...base, percentage: 0 });
    expect(zero.active).toBe(false);
    expect(zero.discountAmountArs).toBe(0);
    expect(zero.totalAfterArs).toBe(11000);
  });

  it('applies the percentage over the "total" base (subtotal + transport)', () => {
    const r = computeCommercialDiscount({ ...base, target: 'total' });
    expect(r.active).toBe(true);
    expect(r.baseArs).toBe(11000);
    expect(r.discountAmountArs).toBe(1100);
    expect(r.totalAfterArs).toBe(9900);
  });

  it('applies the percentage over the "materials" base only', () => {
    const r = computeCommercialDiscount({ ...base, target: 'materials' });
    expect(r.baseArs).toBe(6000);
    expect(r.discountAmountArs).toBe(600);
    expect(r.totalAfterArs).toBe(10400); // full total minus the materials-only discount
    expect(r.discountAmountUsd).toBe(0.6);
  });
});