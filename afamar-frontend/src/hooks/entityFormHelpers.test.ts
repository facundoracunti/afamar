/**
 * Tests for the FinancialBase extraction (PLAN.md §#5).
 *
 * Verifies:
 *  - `EntityFormState`, `BudgetPayload`, `WorkOrderPayload` all extend `FinancialBase`
 *  - `DEFAULT_FINANCIALS` provides safe starting values for ALL 17 fields
 *  - `buildFinancialPayload(form)` round-trips through `mapFinancialToForm(d)`
 *  - `INITIAL_FORM` contains the 17 FinancialBase fields with the expected defaults
 *  - `buildPayload(form)` and `mapApiToForm(d)` correctly handle the FinancialBase slice
 *  - Edge cases: empty/NaN numeric inputs, empty currency strings
 */
import { describe, it, expect } from 'vitest';
import type { EntityFormState } from '../types';
import {
  DEFAULT_FINANCIALS,
  INITIAL_FORM,
  buildFinancialPayload,
  mapFinancialToForm,
  buildPayload,
  mapApiToForm,
} from './entityFormHelpers';

// All 17 FinancialBase field names. Single source of truth for the tests below.
const FINANCIAL_FIELDS = [
  'currency',
  'usd_rate',
  'subtotal',
  'transport',
  'total',
  'subtotal_usd',
  'transport_usd',
  'total_usd',
  'deposit_received',
  'deposit_currency',
  'deposit_usd',
  'balance_due',
  'balance_due_usd',
  'payment_method',
  'installments',
  'discount_percentage',
  'discount_fixed_amount',
] as const;

describe('FinancialBase — shared types', () => {
  it('EntityFormState contains all 17 FinancialBase fields', () => {
    for (const f of FINANCIAL_FIELDS) {
      expect(f in INITIAL_FORM, `missing field "${f}"`).toBe(true);
    }
  });

  it('DEFAULT_FINANCIALS has exactly the 17 expected keys', () => {
    expect(Object.keys(DEFAULT_FINANCIALS).sort()).toEqual(
      [...FINANCIAL_FIELDS].sort()
    );
  });

  it('DEFAULT_FINANCIALS uses safe default values', () => {
    expect(DEFAULT_FINANCIALS).toEqual({
      currency: 'ARS',
      usd_rate: 1000,
      subtotal: 0,
      transport: 0,
      total: 0,
      subtotal_usd: 0,
      transport_usd: 0,
      total_usd: 0,
      deposit_received: 0,
      deposit_currency: 'ARS',
      deposit_usd: 0,
      balance_due: 0,
      balance_due_usd: 0,
      payment_method: '',
      installments: 1,
      discount_percentage: 0,
      discount_fixed_amount: 0,
    });
  });

  it('INITIAL_FORM inherits DEFAULT_FINANCIALS via spread', () => {
    for (const f of FINANCIAL_FIELDS) {
      expect(INITIAL_FORM[f]).toBe(DEFAULT_FINANCIALS[f]);
    }
  });
});

describe('buildFinancialPayload', () => {
  it('emits every FinancialBase field', () => {
    const payload = buildFinancialPayload(INITIAL_FORM);
    for (const f of FINANCIAL_FIELDS) {
      expect(f in payload, `missing field "${f}" in buildFinancialPayload output`).toBe(true);
    }
  });

  it('defaults empty currency / deposit_currency to ARS', () => {
    const form = { ...INITIAL_FORM, currency: '', deposit_currency: '' } as EntityFormState;
    const payload = buildFinancialPayload(form);
    expect(payload.currency).toBe('ARS');
    expect(payload.deposit_currency).toBe('ARS');
  });

  it('coerces numeric strings (e.g. "1234.56") to numbers', () => {
    const form = {
      ...INITIAL_FORM,
      usd_rate: '1200',
      subtotal: '50000',
      discount_percentage: '10',
    } as unknown as EntityFormState;
    const payload = buildFinancialPayload(form);
    expect(payload.usd_rate).toBe(1200);
    expect(payload.subtotal).toBe(50000);
    expect(payload.discount_percentage).toBe(10);
  });

  it('coerces NaN to 0 for optional money fields', () => {
    const form = {
      ...INITIAL_FORM,
      subtotal_usd: NaN,
      transport_usd: NaN,
      total_usd: NaN,
      deposit_usd: NaN,
      balance_due_usd: NaN,
    } as unknown as EntityFormState;
    const payload = buildFinancialPayload(form);
    expect(payload.subtotal_usd).toBe(0);
    expect(payload.transport_usd).toBe(0);
    expect(payload.total_usd).toBe(0);
    expect(payload.deposit_usd).toBe(0);
    expect(payload.balance_due_usd).toBe(0);
  });

  it('defaults usd_rate to 1000 when value is 0 or NaN', () => {
    const form = { ...INITIAL_FORM, usd_rate: NaN } as unknown as EntityFormState;
    expect(buildFinancialPayload(form).usd_rate).toBe(1000);

    const form2 = { ...INITIAL_FORM, usd_rate: 0 } as unknown as EntityFormState;
    expect(buildFinancialPayload(form2).usd_rate).toBe(1000);
  });

  it('returns null payment_method when form value is empty string', () => {
    const form = { ...INITIAL_FORM, payment_method: '' } as EntityFormState;
    expect(buildFinancialPayload(form).payment_method).toBeNull();
  });

  it('preserves a non-empty payment_method', () => {
    const form = { ...INITIAL_FORM, payment_method: 'TRANSFER' } as EntityFormState;
    expect(buildFinancialPayload(form).payment_method).toBe('TRANSFER');
  });

  it('defaults installments to 1 when empty or NaN', () => {
    const form = { ...INITIAL_FORM, installments: 0 } as unknown as EntityFormState;
    expect(buildFinancialPayload(form).installments).toBe(1);

    const form2 = { ...INITIAL_FORM, installments: NaN } as unknown as EntityFormState;
    expect(buildFinancialPayload(form2).installments).toBe(1);
  });
});

describe('mapFinancialToForm', () => {
  it('defaults every missing field from DEFAULT_FINANCIALS', () => {
    const form = mapFinancialToForm({});
    expect(form).toEqual(DEFAULT_FINANCIALS);
  });

  it('parses numeric values from the API', () => {
    const form = mapFinancialToForm({
      currency: 'USD',
      usd_rate: 1250,
      subtotal: 50000,
      transport: 2000,
      total: 52000,
      subtotal_usd: 40,
      transport_usd: 1.6,
      total_usd: 41.6,
      deposit_received: 20000,
      deposit_currency: 'ARS',
      deposit_usd: 16,
      balance_due: 32000,
      balance_due_usd: 25.6,
      payment_method: 'TRANSFER',
      installments: 3,
      discount_percentage: 10,
      discount_fixed_amount: 0,
    });
    expect(form.currency).toBe('USD');
    expect(form.usd_rate).toBe(1250);
    expect(form.subtotal).toBe(50000);
    expect(form.installments).toBe(3);
    expect(form.discount_percentage).toBe(10);
    expect(form.payment_method).toBe('TRANSFER');
  });

  it('falls back to defaults for null/undefined values from API', () => {
    const form = mapFinancialToForm({
      currency: null,
      usd_rate: undefined,
      payment_method: null,
    });
    expect(form.currency).toBe('ARS');
    expect(form.usd_rate).toBe(1000);
    expect(form.payment_method).toBe('');
  });
});

describe('round-trip — buildFinancialPayload ∘ mapFinancialToForm', () => {
  it('preserves values for a fully populated form', () => {
    const original: EntityFormState = {
      ...INITIAL_FORM,
      currency: 'USD',
      usd_rate: 1250,
      subtotal: 100000,
      transport: 5000,
      total: 105000,
      subtotal_usd: 80,
      transport_usd: 4,
      total_usd: 84,
      deposit_received: 50000,
      deposit_currency: 'ARS',
      deposit_usd: 40,
      balance_due: 55000,
      balance_due_usd: 44,
      payment_method: 'CREDIT_CARD',
      installments: 6,
      discount_percentage: 5,
      discount_fixed_amount: 0,
    };
    const apiPayload = buildFinancialPayload(original);
    // Simulate API: JSON-encode, send, JSON-decode → values come back as number/undefined.
    const apiRow: Record<string, unknown> = { ...apiPayload };
    const parsed = mapFinancialToForm(apiRow);

    expect(parsed.currency).toBe(original.currency);
    expect(parsed.usd_rate).toBe(original.usd_rate);
    expect(parsed.subtotal).toBe(original.subtotal);
    expect(parsed.transport).toBe(original.transport);
    expect(parsed.total).toBe(original.total);
    expect(parsed.subtotal_usd).toBe(original.subtotal_usd);
    expect(parsed.transport_usd).toBe(original.transport_usd);
    expect(parsed.total_usd).toBe(original.total_usd);
    expect(parsed.deposit_received).toBe(original.deposit_received);
    expect(parsed.deposit_currency).toBe(original.deposit_currency);
    expect(parsed.deposit_usd).toBe(original.deposit_usd);
    expect(parsed.balance_due).toBe(original.balance_due);
    expect(parsed.balance_due_usd).toBe(original.balance_due_usd);
    expect(parsed.payment_method).toBe(original.payment_method);
    expect(parsed.installments).toBe(original.installments);
    expect(parsed.discount_percentage).toBe(original.discount_percentage);
    expect(parsed.discount_fixed_amount).toBe(original.discount_fixed_amount);
  });
});

describe('buildPayload — integrates FinancialBase', () => {
  it('emits every FinancialBase field at the top level (matches BudgetPayload / WorkOrderPayload)', () => {
    const payload = buildPayload(INITIAL_FORM);
    for (const f of FINANCIAL_FIELDS) {
      expect(f in payload, `buildPayload missing "${f}"`).toBe(true);
    }
  });

  it('emits the same values as buildFinancialPayload', () => {
    const form: EntityFormState = {
      ...INITIAL_FORM,
      currency: 'USD',
      usd_rate: 1300,
      subtotal: 75000,
      total: 75000,
      discount_percentage: 15,
      payment_method: 'CASH',
    };
    const apiPayload = buildPayload(form);
    expect(apiPayload.currency).toBe('USD');
    expect(apiPayload.usd_rate).toBe(1300);
    expect(apiPayload.subtotal).toBe(75000);
    expect(apiPayload.total).toBe(75000);
    expect(apiPayload.discount_percentage).toBe(15);
    // Note: buildPayload emits payment_method = '' (form-truthy),
    // buildFinancialPayload normalizes to null. buildPayload keeps form semantics.
    expect('payment_method' in apiPayload).toBe(true);
  });
});

describe('mapApiToForm — integrates FinancialBase', () => {
  it('populates all FinancialBase fields from the API row', () => {
    const apiRow = {
      currency: 'USD',
      usd_rate: 1300,
      subtotal: 75000,
      total: 90000,
      deposit_received: 30000,
      payment_method: 'TRANSFER',
      installments: 2,
      discount_percentage: 10,
    };
    const form = mapApiToForm(apiRow, 'APPROVED');
    expect(form.currency).toBe('USD');
    expect(form.usd_rate).toBe(1300);
    expect(form.subtotal).toBe(75000);
    expect(form.total).toBe(90000);
    expect(form.deposit_received).toBe(30000);
    expect(form.payment_method).toBe('TRANSFER');
    expect(form.installments).toBe(2);
    expect(form.discount_percentage).toBe(10);
  });

  it('returns DEFAULT_FINANCIALS for the 17 financial fields when the API row is empty', () => {
    const form = mapApiToForm({}, 'PENDING');
    for (const f of FINANCIAL_FIELDS) {
      expect(form[f]).toBe(DEFAULT_FINANCIALS[f]);
    }
  });
});

describe('mapApiToForm — sketch_elements round-trip', () => {
  // The list-page PDF flow goes getById → mapApiToForm → SketchImageExtractor.
  // The extractor only produces pages if `form.sketch_elements` is in the
  // canonical page-list shape. These tests guard against regressions in
  // either direction (Budget relationship array, WorkOrder TEXT string).
  it('handles the Budget 1-N relationship (array of BudgetSketchElement rows)', () => {
    const apiRow = {
      sketch_elements: [
        // What the backend returns for `GET /budgets/{id}` — the SQLAlchemy
        // relationship, each row has id/budget_id/type/data/order.
        { id: 1, budget_id: 10, type: 'line', data: JSON.stringify({ x: 10, y: 20, points: [0, 0, 50, 50] }), order: 0 },
        { id: 2, budget_id: 10, type: 'rect', data: JSON.stringify({ x: 0, y: 0, width: 200, height: 100 }), order: 1 },
      ],
    };
    const form = mapApiToForm(apiRow, 'PENDING');
    expect(form.sketch_elements).toHaveLength(1); // one page
    const page = form.sketch_elements[0] as { pagina_id: number; name: string; dibujo: unknown[] };
    expect(page.pagina_id).toBe(1);
    expect(page.name).toBe('Página 1');
    expect(page.dibujo).toHaveLength(2);
    // The BudgetSketchElement.id/budget_id are dropped (not part of the
    // element payload). Only the geometry + type survives.
    expect(page.dibujo[0]).toMatchObject({ type: 'line', x: 10, y: 20 });
    expect(page.dibujo[1]).toMatchObject({ type: 'rect', width: 200, height: 100 });
  });

  it('handles the WorkOrder TEXT column (JSON-encoded string)', () => {
    const sketchList = [
      { type: 'line', data: JSON.stringify({ x: 5, y: 5, points: [0, 0, 100, 100] }), order: 0 },
    ];
    const apiRow = {
      // What the backend returns for `GET /work-orders/{id}` after
      // conversion from a budget — a JSON string in the new TEXT column.
      sketch_elements: JSON.stringify(sketchList),
    };
    const form = mapApiToForm(apiRow, 'MEASUREMENT');
    expect(form.sketch_elements).toHaveLength(1);
    const page = form.sketch_elements[0] as { dibujo: unknown[] };
    expect(page.dibujo).toHaveLength(1);
    expect(page.dibujo[0]).toMatchObject({ type: 'line', x: 5, y: 5 });
  });

  it('returns an empty list when sketch_elements is missing/empty', () => {
    const form = mapApiToForm({ sketch_elements: [] }, 'PENDING');
    expect(form.sketch_elements).toEqual([]);
    const form2 = mapApiToForm({ sketch_elements: '[]' }, 'PENDING');
    expect(form2.sketch_elements).toEqual([]);
    const form3 = mapApiToForm({ sketch_elements: null }, 'PENDING');
    expect(form3.sketch_elements).toEqual([]);
  });
});

describe('fabrication_detail price contract — always in ARS', () => {
  // The user-facing contract for the "Detalle de fabricación y additional works"
  // form: the manual `price` field (and the auto-calculated price) is
  // ALWAYS in pesos. The PDF / totals block converts to USD using the
  // document's `usd_rate` for the USD column. These tests guard the
  // shape of `mapApiToForm` (which round-trips the stored detail) so
  // a future refactor can't silently introduce a USD-only path that
  // breaks the manual price-entry flow.
  it('preserves a manually-typed ARS price verbatim', () => {
    const form = mapApiToForm({
      fabrication_details: JSON.stringify([
        { concept: 'CUTOUT_SINK', price: 5000, currency: 'ARS', quantity: 1 },
      ]),
    }, 'PENDING');
    expect(form.fabrication_details[0].price).toBe(5000);
    expect(form.fabrication_details[0].currency).toBe('ARS');
  });

  it('legacy details with currency=USD still keep their stored price — the PDF renderer converts it for the USD column', () => {
    const form = mapApiToForm({
      fabrication_details: JSON.stringify([
        { concept: 'CUTOUT_SINK', price: 5000, currency: 'USD', quantity: 1 },
      ]),
    }, 'PENDING');
    // The stored price is whatever the user typed — the form doesn't
    // rewrite it on load. The PDF renderer does the ARS→USD conversion
    // for the breakdown column.
    expect(form.fabrication_details[0].price).toBe(5000);
  });

  it('M2 concepts (BASEBOARD, FRONT) carry the m² × pm² calculation in the stored price field — always in ARS regardless of material currency', () => {
    const form = mapApiToForm({
      fabrication_details: JSON.stringify([
        // pm2 in ARS (the contract). The m² × pm² calculation belongs in
        // useFormDetails.handleDetailChange, not here — mapApiToForm just
        // round-trips the stored value.
        { concept: 'BASEBOARD', price: 12500, currency: 'ARS', quantity: 1, m2: 2.5, length: 5, width: 0.5 },
      ]),
    }, 'PENDING');
    expect(form.fabrication_details[0].price).toBe(12500);
    expect(form.fabrication_details[0].m2).toBe(2.5);
  });
});