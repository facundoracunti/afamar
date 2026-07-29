/**
 * Tests for the `useBudgetCalculations` hook.
 *
 * Strategy: render the hook with a real useState-backed form + setForm,
 * let the useEffect fire, and assert the resulting form values reflect
 * the expected calculation.
 *
 * Verifies:
 *  - empty form: subtotal/total = 0, balance_due = 0
 *  - transport is added to the base total
 *  - percentage discount reduces total (and discount_fixed_amount clears it)
 *  - fixed discount reduces total (and discount_percentage clears it)
 *  - installment surcharge (TARJETA DE CRÉDITO) is applied to the total
 *  - the alternative-material total replaces the principal total when alternatives exist
 *  - a USD rate of 0 is treated as 0 (subtotal stays in pure ARS)
 *  - deposit_received (ARS) is subtracted from the total in balance_due
 *  - balance_due never goes negative
 */
import { describe, expect, it } from 'vitest';
import React, { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { useBudgetCalculations } from './useBudgetCalculations';
import type { EntityFormState, MaterialInForm } from '../types';
import type { FabricationDetail, PoolInForm } from '../types/budget';

function makeForm(overrides: Partial<EntityFormState> = {}): EntityFormState {
  return {
    fabrication_details: [],
    materials_data: [],
    pools_data: [],
    additional_works_data: '[]',
    transport: 0,
    transport_usd: 0,
    usd_rate: 1000,
    payment_method: 'EFECTIVO',
    installments: 1,
    discount_percentage: 0,
    discount_fixed_amount: 0,
    deposit_received: 0,
    deposit_usd: 0,
    deposit_currency: 'ARS',
    subtotal: 0,
    total: 0,
    subtotal_usd: 0,
    total_usd: 0,
    balance_due: 0,
    balance_due_usd: 0,
    ...overrides,
  } as EntityFormState;
}

function renderCalc(initial: EntityFormState) {
  const result = renderHook(
    ({ form }: { form: EntityFormState }) => {
      const [current, setCurrent] = useState<EntityFormState>(form);
      useBudgetCalculations(current, setCurrent);
      return { form: current, setForm: setCurrent };
    },
    { initialProps: { form: initial } },
  );
  return result;
}

describe('useBudgetCalculations — basic totals', () => {
  it('returns zero for an empty form', () => {
    const { result } = renderCalc(makeForm({ usd_rate: 1000 }));
    expect(result.current.form.subtotal).toBe(0);
    expect(result.current.form.total).toBe(0);
    expect(result.current.form.balance_due).toBe(0);
  });

  it('adds transport to the total', () => {
    const fabrication_details: FabricationDetail[] = [
      { concept: 'LENGTH', detail: '', length: 1, width: 0, m2: 1, labor: 0, currency: 'ARS', quantity: 1, price: 2000 },
    ];
    const { result } = renderCalc(makeForm({ fabrication_details, transport: 1500 }));
    expect(result.current.form.subtotal).toBe(2000);
    expect(result.current.form.total).toBe(3500); // 2000 + 1500
  });
});

describe('useBudgetCalculations — discounts', () => {
  it('applies discount_percentage', () => {
    const fabrication_details: FabricationDetail[] = [
      { concept: 'LENGTH', detail: '', length: 1, width: 0, m2: 1, labor: 0, currency: 'ARS', quantity: 1, price: 10000 },
    ];
    const { result } = renderCalc(makeForm({
      fabrication_details,
      discount_percentage: 10,
    }));
    expect(result.current.form.total).toBe(9000); // 10000 * 0.9
  });

  it('applies discount_fixed_amount when set', () => {
    const fabrication_details: FabricationDetail[] = [
      { concept: 'LENGTH', detail: '', length: 1, width: 0, m2: 1, labor: 0, currency: 'ARS', quantity: 1, price: 10000 },
    ];
    const { result } = renderCalc(makeForm({
      fabrication_details,
      discount_fixed_amount: 3000,
    }));
    expect(result.current.form.total).toBe(7000); // 10000 - 3000
  });
});

describe('useBudgetCalculations — installments surcharge', () => {
  it('adds 0% for 1 installment, 15% for 3 installments with tarjeta de crédito', () => {
    const fabrication_details: FabricationDetail[] = [
      { concept: 'LENGTH', detail: '', length: 1, width: 0, m2: 1, labor: 0, currency: 'ARS', quantity: 1, price: 10000 },
    ];
    // Tarjeta 1 cuota → sin recargo
    const { result: r1 } = renderCalc(makeForm({
      fabrication_details,
      payment_method: 'TARJETA DE CRÉDITO',
      installments: 1,
    }));
    expect(r1.current.form.total).toBe(10000);

    // Tarjeta 3 cuotas → +15%
    const { result: r3 } = renderCalc(makeForm({
      fabrication_details,
      payment_method: 'TARJETA DE CRÉDITO',
      installments: 3,
    }));
    expect(r3.current.form.total).toBe(11500); // 10000 + 15% (rounded)
  });
});

describe('useBudgetCalculations — alternative material total override', () => {
  it('replaces the total with the first alternative material’s total when alternatives exist', () => {
    const mats: MaterialInForm[] = [
      { id: 1, name: 'Negro Brasil', currency: 'USD', price_m2: 0, price_m2_usd: 100, quantity: 1, m2_used: 0, m2_budgeted: 0, length: 5, width: 1, is_alternative: false },
      { id: 2, name: 'Marmol Carrara', currency: 'USD', price_m2: 0, price_m2_usd: 50, quantity: 1, m2_used: 0, m2_budgeted: 0, length: 1, width: 1, is_alternative: true },
    ];
    const { result } = renderCalc(makeForm({
      materials_data: mats,
      usd_rate: 1000,
    }));
    // Principal: 5 * 1 * 1 * 100 = 500 USD = 500_000 ARS
    // Alternative: 1 * 1 * 1 * 50 = 50 USD = 50_000 ARS
    // The hook should pick the alternative: 50_000 ARS
    expect(result.current.form.total).toBe(50_000);
  });
});

describe('useBudgetCalculations — deposit & balance_due', () => {
  it('subtracts deposit_received from total in balance_due', () => {
    const fabrication_details: FabricationDetail[] = [
      { concept: 'LENGTH', detail: '', length: 1, width: 0, m2: 1, labor: 0, currency: 'ARS', quantity: 1, price: 10000 },
    ];
    const { result } = renderCalc(makeForm({
      fabrication_details,
      deposit_received: 3000,
    }));
    expect(result.current.form.total).toBe(10000);
    expect(result.current.form.balance_due).toBe(7000);
  });

  it('clamps balance_due to 0 when deposit exceeds total', () => {
    const fabrication_details: FabricationDetail[] = [
      { concept: 'LENGTH', detail: '', length: 1, width: 0, m2: 1, labor: 0, currency: 'ARS', quantity: 1, price: 1000 },
    ];
    const { result } = renderCalc(makeForm({
      fabrication_details,
      deposit_received: 5000,
    }));
    expect(result.current.form.total).toBe(1000);
    expect(result.current.form.balance_due).toBe(0);
  });
});

describe('useBudgetCalculations — USD handling', () => {
  it('treats usd_rate=0 as no conversion (subtotal stays in ARS)', () => {
    const fabrication_details: FabricationDetail[] = [
      { concept: 'CUTOUT_SINK', detail: '', length: 0, width: 0, m2: 0, labor: 0, currency: 'USD', quantity: 1, price: 50 },
    ];
    const pools_data: PoolInForm[] = [
      { pool_id: 1, brand: 'X', model: 'Y', price: 1000, currency: 'ARS', quantity: 1 },
    ];
    const { result } = renderCalc(makeForm({
      fabrication_details,
      pools_data,
      usd_rate: 0,
    }));
    // 50 USD → 0 ARS (rate=0), pool 1000 ARS. Subtotal = 0 + 1000 = 1000.
    expect(result.current.form.subtotal).toBe(1000);
  });
});
