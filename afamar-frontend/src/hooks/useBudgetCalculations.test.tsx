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
 *  - catalogue-driven surcharge (Tarjeta de crédito) is applied per cuota
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
import type { PaymentMethod } from '../types/paymentMethod';

/**
 * Catalogue fixture mirroring the 4 default rows seeded by
 * `scripts/seeders/payment_methods.py` (only the credit-card row is
 * used in the surcharge tests below).
 */
const PAYMENT_METHODS: PaymentMethod[] = [
  { id: 1, name: 'EFECTIVO', label: 'Efectivo', color: null, is_active: true, sort_order: 10, type: 'NONE', value: 0, is_percentage: false, applies_to_installments: false, created_at: null, updated_at: null },
  { id: 2, name: 'TRANSFERENCIA BANCARIA', label: 'Transferencia bancaria', color: null, is_active: true, sort_order: 20, type: 'NONE', value: 0, is_percentage: false, applies_to_installments: false, created_at: null, updated_at: null },
  { id: 3, name: 'TARJETA DE DÉBITO', label: 'Tarjeta de débito', color: null, is_active: true, sort_order: 30, type: 'NONE', value: 0, is_percentage: false, applies_to_installments: false, created_at: null, updated_at: null },
  { id: 4, name: 'TARJETA DE CRÉDITO', label: 'Tarjeta de crédito', color: null, is_active: true, sort_order: 40, type: 'SURCHARGE', value: 9, is_percentage: true, applies_to_installments: true, created_at: null, updated_at: null },
];

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
    payment_method_id: 1,
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

function renderCalc(initial: EntityFormState, paymentMethods: PaymentMethod[] = PAYMENT_METHODS) {
  const result = renderHook(
    ({ form, pms }: { form: EntityFormState; pms: PaymentMethod[] }) => {
      const [current, setCurrent] = useState<EntityFormState>(form);
      useBudgetCalculations(current, setCurrent, pms);
      return { form: current, setForm: setCurrent };
    },
    { initialProps: { form: initial, pms: paymentMethods } },
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

describe('useBudgetCalculations — apply_cash_discount opt-in (catalogue DISCOUNT)', () => {
  // TRANSFER is configured as DISCOUNT 5% (percentage). The total must
  // equal the subtotal when the flag is off and drop to subtotal × 0.95
  // when the flag is on — and the hook must react to the toggle without
  // requiring any other field change.
  const TRANSFER_DISCOUNT = PAYMENT_METHODS.map((pm) =>
    pm.name === 'TRANSFERENCIA BANCARIA'
      ? { ...pm, type: 'DISCOUNT' as const, value: 5, is_percentage: true }
      : pm
  );
  const fabrication_details: FabricationDetail[] = [
    { concept: 'LENGTH', detail: '', length: 1, width: 0, m2: 1, labor: 0, currency: 'ARS', quantity: 1, price: 10000 },
  ];

  it('leaves the total = subtotal when apply_cash_discount is off', () => {
    const { result } = renderCalc(
      makeForm({
        fabrication_details,
        payment_method: 'TRANSFERENCIA BANCARIA',
        payment_method_id: 2,
        installments: 1,
        apply_cash_discount: false,
      }),
      TRANSFER_DISCOUNT
    );
    expect(result.current.form.subtotal).toBe(10000);
    expect(result.current.form.total).toBe(10000);
  });

  it('recalculates the total live when the flag toggles to true (regression sentinel for the useEffect dep)', () => {
    const initial = makeForm({
      fabrication_details,
      payment_method: 'TRANSFERENCIA BANCARIA',
      payment_method_id: 2,
      installments: 1,
      apply_cash_discount: false,
    });
    const { result } = renderCalc(initial, TRANSFER_DISCOUNT);
    expect(result.current.form.total).toBe(10000);

    // Toggle the flag without touching anything else. The hook's deps
    // must include `apply_cash_discount` so this single change triggers
    // the recalc and the total drops to 9500.
    act(() => {
      result.current.setForm({ ...initial, apply_cash_discount: true });
    });
    expect(result.current.form.total).toBe(9500);

    // Toggling back to false restores the subtotal.
    act(() => {
      result.current.setForm({ ...initial, apply_cash_discount: false });
    });
    expect(result.current.form.total).toBe(10000);
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

describe('useBudgetCalculations — catalogue-driven surcharge (recargo lineal por cuota)', () => {
  // The rule is `base × (1 + N × value/100)`. With value=9:
  //   N=1 → +9%   → total = base × 1.09
  //   N=2 → +18%  → total = base × 1.18
  //   N=3 → +27%  → total = base × 1.27
  // Cada cuota = total / N (uniforme, todas iguales).
  it('1 cuota adds 9% (total = base × 1.09)', () => {
    const fabrication_details: FabricationDetail[] = [
      { concept: 'LENGTH', detail: '', length: 1, width: 0, m2: 1, labor: 0, currency: 'ARS', quantity: 1, price: 10000 },
    ];
    const { result } = renderCalc(makeForm({
      fabrication_details,
      payment_method: 'TARJETA DE CRÉDITO',
      payment_method_id: 4,
      installments: 1,
    }));
    expect(result.current.form.total).toBe(10900);
  });

  it('2 cuotas adds 18% (total = base × 1.18, cuota = 5900)', () => {
    const fabrication_details: FabricationDetail[] = [
      { concept: 'LENGTH', detail: '', length: 1, width: 0, m2: 1, labor: 0, currency: 'ARS', quantity: 1, price: 10000 },
    ];
    const { result } = renderCalc(makeForm({
      fabrication_details,
      payment_method: 'TARJETA DE CRÉDITO',
      payment_method_id: 4,
      installments: 2,
    }));
    expect(result.current.form.total).toBe(11800); // 10000 × 1.18
  });

  it('3 cuotas adds 27% (total = base × 1.27, cuota = 4233.33)', () => {
    const fabrication_details: FabricationDetail[] = [
      { concept: 'LENGTH', detail: '', length: 1, width: 0, m2: 1, labor: 0, currency: 'ARS', quantity: 1, price: 10000 },
    ];
    const { result } = renderCalc(makeForm({
      fabrication_details,
      payment_method: 'TARJETA DE CRÉDITO',
      payment_method_id: 4,
      installments: 3,
    }));
    expect(result.current.form.total).toBe(12700); // 10000 × 1.27
  });

  it('matches the customer-facing example: base=900000, 3 cuotas, value=9 → 1_143_000, cada cuota = 381_000', () => {
    const fabrication_details: FabricationDetail[] = [
      { concept: 'LENGTH', detail: '', length: 1, width: 0, m2: 1, labor: 0, currency: 'ARS', quantity: 1, price: 900000 },
    ];
    const { result } = renderCalc(makeForm({
      fabrication_details,
      payment_method: 'TARJETA DE CRÉDITO',
      payment_method_id: 4,
      installments: 3,
    }));
    expect(result.current.form.total).toBe(1143000); // 900000 × 1.27
  });

  it('exposes installment_detail_ars with uniform rows (3 cuotas, base=900000)', () => {
    const fabrication_details: FabricationDetail[] = [
      { concept: 'LENGTH', detail: '', length: 1, width: 0, m2: 1, labor: 0, currency: 'ARS', quantity: 1, price: 900000 },
    ];
    const { result } = renderCalc(makeForm({
      fabrication_details,
      payment_method: 'TARJETA DE CRÉDITO',
      payment_method_id: 4,
      installments: 3,
    }));
    // total = 900000 × 1.27 = 1143000; cuota = 1143000 / 3 = 381000 (todas iguales)
    expect(result.current.form.installment_detail_ars).toEqual([
      { cuota: 1, interes: 9, monto: 381000 },
      { cuota: 2, interes: 9, monto: 381000 },
      { cuota: 3, interes: 9, monto: 381000 },
    ]);
  });

  it('returns empty installment_detail for non-credit-card payment methods', () => {
    const fabrication_details: FabricationDetail[] = [
      { concept: 'LENGTH', detail: '', length: 1, width: 0, m2: 1, labor: 0, currency: 'ARS', quantity: 1, price: 10000 },
    ];
    const { result } = renderCalc(makeForm({
      fabrication_details,
      payment_method: 'EFECTIVO',
      payment_method_id: 1,
      installments: 1,
    }));
    expect(result.current.form.installment_detail_ars).toEqual([]);
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

  it('rounds subtotal_usd to 2dp when converting ARS items', () => {
    // Item in ARS should be converted to USD with 2dp rounding.
    const fabrication_details: FabricationDetail[] = [
      { concept: 'LENGTH', detail: '', length: 1, width: 0, m2: 1, labor: 0, currency: 'ARS', quantity: 1, price: 1234 },
    ];
    const { result } = renderCalc(makeForm({ fabrication_details, usd_rate: 1000 }));
    // 1234 ARS / 1000 = 1.234 USD → round2 = 1.23
    expect(result.current.form.subtotal_usd).toBe(1.23);
  });

  it('rounds USD surcharge to 2dp (not integer) for credit card installments', () => {
    // Bug 1: previously used Math.round() which truncated fractional cents.
    const fabrication_details: FabricationDetail[] = [
      { concept: 'CUTOUT_SINK', detail: '', length: 0, width: 0, m2: 0, labor: 0, currency: 'USD', quantity: 2, price: 55.25 },
    ];
    const { result } = renderCalc(makeForm({
      fabrication_details,
      usd_rate: 1000,
      payment_method: 'TARJETA DE CRÉDITO',
      payment_method_id: 4,
      installments: 3,
    }));
    // subtotal_usd = 110.50, no transport. Recargo lineal (value=9, N=3):
    // ratio = 1.27 → total_usd = 110.50 × 1.27 = 140.34 (round2).
    expect(result.current.form.total_usd).toBe(140.34);
  });

  it('rounds USD total after percentage discount to 2dp', () => {
    const fabrication_details: FabricationDetail[] = [
      { concept: 'CUTOUT_SINK', detail: '', length: 0, width: 0, m2: 0, labor: 0, currency: 'USD', quantity: 1, price: 200 },
    ];
    const { result } = renderCalc(makeForm({
      fabrication_details,
      usd_rate: 1000,
      discount_percentage: 15,
    }));
    // subtotal_usd = 200, discount 15% → total = 200 * 0.85 = 170.00
    expect(result.current.form.total_usd).toBe(170);
  });

  it('rounds USD total after fixed discount to 2dp', () => {
    const fabrication_details: FabricationDetail[] = [
      { concept: 'CUTOUT_SINK', detail: '', length: 0, width: 0, m2: 0, labor: 0, currency: 'USD', quantity: 1, price: 200 },
    ];
    const { result } = renderCalc(makeForm({
      fabrication_details,
      usd_rate: 1000,
      discount_fixed_amount: 5000,
    }));
    // subtotal_usd = 200, discount = 5000 ARS / 1000 = 5 USD → total = 200 - 5 = 195.00
    expect(result.current.form.total_usd).toBe(195);
  });

  it('applies USD surcharge with 2dp rounding in alternative material path', () => {
    const mats: MaterialInForm[] = [
      { id: 1, name: 'Negro Brasil', currency: 'USD', price_m2: 0, price_m2_usd: 100, quantity: 1, m2_used: 0, m2_budgeted: 0, length: 1, width: 1, is_alternative: false },
      { id: 2, name: 'Marmol Carrara', currency: 'USD', price_m2: 0, price_m2_usd: 85.50, quantity: 1, m2_used: 0, m2_budgeted: 0, length: 1, width: 1, is_alternative: true },
    ];
    const { result } = renderCalc(makeForm({
      materials_data: mats,
      usd_rate: 1000,
      payment_method: 'TARJETA DE CRÉDITO',
      payment_method_id: 4,
      installments: 3,
    }));
    // Alternative replaces principal: mat cost = 85.50 USD
    // Recargo lineal (value=9, N=3): ratio = 1.27
    // total_usd = 85.50 × 1.27 = 108.585 → round2 = 108.59
    expect(result.current.form.total_usd).toBe(108.59);
  });
});

describe('useBudgetCalculations — additional_works_data triggers total recompute', () => {
  /**
   * Regression test: the on-form subtotal/total/balance_due in the
   * Presupuesto section were stale after the operator added/edited/removed
   * a Trabajo Adicional because `form.additional_works_data` was missing
   * from the hook's dependency array. The PDF (re-rendered server-side)
   * was always correct, which is why both surfaces diverged.
   *
   * Now that the dep is included (JSON.stringify of the snapshot), adding
   * an additional work must re-fire the effect and bump `form.total` /
   * `form.balance_due` so the Presupuesto section agrees with the PDF.
   */
  it('updates form.total / balance_due when additional_works_data changes', () => {
    const { result } = renderCalc(makeForm({
      additional_works_data: '[]',
      usd_rate: 1000,
    }));
    expect(result.current.form.total).toBe(0);
    expect(result.current.form.balance_due).toBe(0);

    act(() => {
      result.current.setForm((prev) => ({
        ...prev,
        additional_works_data: JSON.stringify([
          {
            additional_work_id: 1,
            name: 'Pulido de bordes',
            detail: null,
            price: 15000,
            currency: 'ARS',
            quantity: 2,
            total: 30000,
            materialName: '__GLOBAL__',
            type: 'flat',
          },
        ]),
      }));
    });
    expect(result.current.form.subtotal).toBe(30000);
    expect(result.current.form.total).toBe(30000);
    expect(result.current.form.balance_due).toBe(30000);
  });

  it('updates form.total when the operator removes the last additional work', () => {
    const { result } = renderCalc(makeForm({
      additional_works_data: JSON.stringify([
        {
          additional_work_id: 24,
          name: 'Frente doble',
          detail: null,
          price: 0,
          currency: 'ARS',
          quantity: 1,
          total: 26000,
          materialName: 'Negro Brasil',
          type: 'frente',
          linear_meters: 1,
          formula_values: {
            material_price_m2_at_selection: 200000,
            multiplier: 1.15,
            computed_at: '2026-01-01T00:00:00.000Z',
          },
        },
      ]),
      usd_rate: 1000,
    }));
    // Triggers the recalc on mount once, then again after the clear.
    expect(result.current.form.total).toBe(26000);
    act(() => {
      result.current.setForm((prev) => ({ ...prev, additional_works_data: '[]' }));
    });
    expect(result.current.form.total).toBe(0);
  });

  it('excludes pools/fabrication/additional-works tied to an alternative from the main Presupuesto subtotal', async () => {
    // Materials: 1 main + 1 alternative
    const materialsData: MaterialInForm[] = [
      { id: 1, name: 'GRIS MARA', price_m2: 100, price_m2_usd: 0, currency: 'ARS', quantity: 1, m2_used: 1, m2_budgeted: 1, length: 1, width: 1, is_alternative: false },
      { id: 2, name: 'NEGRO BRASIL', price_m2: 200, price_m2_usd: 0, currency: 'ARS', quantity: 1, m2_used: 1, m2_budgeted: 1, length: 1, width: 1, is_alternative: true },
    ];
    // Pool atado al alternativo → NO debe contar en el subtotal principal
    const poolsData: PoolInForm[] = [
      { pool_id: 1, brand: 'Johnson', model: 'E36', price: 50000, currency: 'ARS', quantity: 1, material: 'NEGRO BRASIL' },
      { pool_id: 2, brand: 'MiPileta', model: 'Doble', price: 30000, currency: 'ARS', quantity: 1, material: '__GLOBAL__' },
    ];
    // Fabrication atada al main → SÍ cuenta
    const fabricationDetails: FabricationDetail[] = [
      { concept: 'BASEBOARD', detail: 'Zocalo', material: 'GRIS MARA', material_price_m2: 0, length: 0, width: 0, m2: 0, labor: null, currency: 'ARS', quantity: 2, price: 10000 },
      { concept: 'OTHER', detail: 'Apertura pileta', material: 'NEGRO BRASIL', material_price_m2: 0, length: 0, width: 0, m2: 0, labor: null, currency: 'ARS', quantity: 1, price: 20000 },
    ];
    const additional_works_data = JSON.stringify([
      // Global → SÍ cuenta
      { additional_work_id: 1, name: 'Pulido', price: 5000, currency: 'ARS', quantity: 1, total: 5000, materialName: '__GLOBAL__', type: 'flat' },
      // Tied to alt → NO cuenta
      { additional_work_id: 2, name: 'Frente alt', price: 0, currency: 'ARS', quantity: 1, total: 8000, materialName: '__ALT__:NEGRO BRASIL', type: 'frente', linear_meters: 1, formula_values: null },
    ]);

    const { result } = renderCalc(makeForm({
      usd_rate: 1000,
      materials_data: materialsData,
      pools_data: poolsData,
      fabrication_details: fabricationDetails,
      additional_works_data,
    }));

    // Esperado en el subtotal principal:
    //   GRIS MARA 1m² x $100 = 100
    //   + Pileta global $30.000
    //   + Zócalo GRIS MARA $20.000 (2 x $10.000)
    //   + Pulido global $5.000
    //   = 55.100
    // NO incluye: Pileta NEGRO BRASIL $50.000, Apertura NEGRO BRASIL $20.000, Frente alt $8.000
    expect(result.current.form.subtotal).toBe(55100);
  });
});
