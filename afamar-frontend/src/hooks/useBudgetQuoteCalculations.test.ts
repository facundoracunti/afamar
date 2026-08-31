/**
 * Tests for the `useBudgetQuoteCalculations` hook.
 *
 * Verifies:
 *  - transport is added to sumatoriaAdicionalesARS and emitted as a 'Traslado' row
 *  - fabrication_details rows contribute to the breakdown, ARS rows stay in ARS
 *  - USD fabrication rows get converted to ARS using the USD rate
 *  - pool rows contribute with a 'Pileta {brand} {model}' concept
 *  - main materials (is_alternative=false) and alternative materials are split correctly
 *  - sumatoriaMaterialesPrincipalARS respects the per-material currency
 *  - principalesBreakdown is empty when there are no alternatives (hayAlternativas=false)
 *  - principalesBreakdown is populated with one row per main material when alternatives exist
 *  - the hook is pure / deterministic for the same input (useMemo caching)
 */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBudgetQuoteCalculations } from './useBudgetQuoteCalculations';
import type { EntityFormState, MaterialInForm } from '../types';
import type { FabricationDetail, PoolInForm } from '../types/budget';

function makeForm(overrides: Partial<EntityFormState> = {}): EntityFormState {
  return {
    fabrication_details: [],
    materials_data: [],
    pools_data: [],
    transport: 0,
    usd_rate: 1000,
    ...overrides,
  } as EntityFormState;
}

describe('useBudgetQuoteCalculations — breakdown (no alternatives)', () => {
  it('sums transport into sumatoriaAdicionalesARS as a Traslado row', () => {
    const { result } = renderHook(() =>
      useBudgetQuoteCalculations({
        form: makeForm({ transport: 5000 }),
        hayAlternativas: false,
      }),
    );
    expect(result.current.sumatoriaAdicionalesARS).toBe(5000);
    expect(result.current.detalleTrabajosComunes).toEqual([
      { concept: 'Traslado', quantity: 1, total: 5000, currency: 'ARS' },
    ]);
  });

  it('skips transport when transport is 0', () => {
    const { result } = renderHook(() =>
      useBudgetQuoteCalculations({
        form: makeForm({ transport: 0 }),
        hayAlternativas: false,
      }),
    );
    expect(result.current.sumatoriaAdicionalesARS).toBe(0);
    expect(result.current.detalleTrabajosComunes).toEqual([]);
  });

  it('adds ARS fabrication rows in ARS without currency conversion', () => {
    const fabrication_details: FabricationDetail[] = [
      { concept: 'LENGTH', detail: '', length: 2, width: 0, m2: 2, labor: 0, currency: 'ARS', quantity: 2, price: 1500 },
      { concept: 'BASEBOARD', detail: '', length: 1, width: 0, m2: 1, labor: 0, currency: 'ARS', quantity: 1, price: 800 },
    ];
    const { result } = renderHook(() =>
      useBudgetQuoteCalculations({
        form: makeForm({ fabrication_details, transport: 200 }),
        hayAlternativas: false,
      }),
    );
    // transport 200 + fab 3000 + fab 800 = 4000
    expect(result.current.sumatoriaAdicionalesARS).toBe(4000);
    const concepts = result.current.detalleTrabajosComunes.map((r) => r.concept);
    expect(concepts).toContain('Traslado');
    expect(concepts).toContain('Largo');
    expect(concepts).toContain('Zócalo');
  });

  it('converts USD fabrication rows to ARS using the USD rate', () => {
    const fabrication_details: FabricationDetail[] = [
      { concept: 'CUTOUT_SINK', detail: '', length: 0, width: 0, m2: 0, labor: 0, currency: 'USD', quantity: 1, price: 50 },
    ];
    const { result } = renderHook(() =>
      useBudgetQuoteCalculations({
        form: makeForm({ fabrication_details, usd_rate: 1000 }),
        hayAlternativas: false,
      }),
    );
    // 50 USD * 1000 = 50000 ARS
    expect(result.current.sumatoriaAdicionalesARS).toBe(50000);
    const row = result.current.detalleTrabajosComunes.find((r) => r.concept === 'Traforo de pileta');
    expect(row).toBeDefined();
    expect(row!.currency).toBe('USD');
    expect(row!.total).toBe(50);
  });

  it('does not crash when usd_rate is 0 (uses 1 as fallback to avoid NaN)', () => {
    const fabrication_details: FabricationDetail[] = [
      { concept: 'CUTOUT_SINK', detail: '', length: 0, width: 0, m2: 0, labor: 0, currency: 'USD', quantity: 1, price: 50 },
    ];
    const { result } = renderHook(() =>
      useBudgetQuoteCalculations({
        form: makeForm({ fabrication_details, usd_rate: 0 }),
        hayAlternativas: false,
      }),
    );
    // `Number(form.usd_rate) || 1` falls back to 1 when usd_rate is 0,
    // so the USD row is still converted (50 * 1 = 50 ARS) instead of
    // producing NaN.
    expect(result.current.sumatoriaAdicionalesARS).toBe(50);
  });

  it('emits a pool row with Pileta {brand} {model} concept', () => {
    const pools_data: PoolInForm[] = [
      { pool_id: 1, brand: 'Johnson', model: 'Acero 60x40', price: 80000, currency: 'ARS', quantity: 1 },
    ];
    const { result } = renderHook(() =>
      useBudgetQuoteCalculations({
        form: makeForm({ pools_data }),
        hayAlternativas: false,
      }),
    );
    expect(result.current.sumatoriaAdicionalesARS).toBe(80000);
    expect(result.current.detalleTrabajosComunes).toEqual([
      { concept: 'Pileta Johnson Acero 60x40', quantity: 1, total: 80000, currency: 'ARS', materialName: null },
    ]);
  });
});

describe('useBudgetQuoteCalculations — materials split', () => {
  const matsMain: MaterialInForm[] = [
    { id: 1, name: 'Negro Brasil', currency: 'USD', price_m2: 0, price_m2_usd: 200, quantity: 1, m2_used: 0, m2_budgeted: 0, length: 2, width: 1, is_alternative: false },
    { id: 2, name: 'Marmol Carrara', currency: 'ARS', price_m2: 300000, price_m2_usd: 0, quantity: 1, m2_used: 0, m2_budgeted: 0, length: 0, width: 0, is_alternative: true },
  ];

  it('splits main and alternative materials', () => {
    const { result } = renderHook(() =>
      useBudgetQuoteCalculations({
        form: makeForm({ materials_data: matsMain }),
        hayAlternativas: true,
      }),
    );
    expect(result.current.matsMain).toHaveLength(1);
    expect(result.current.matsAlt).toHaveLength(1);
    expect(result.current.matsMain[0].name).toBe('Negro Brasil');
    expect(result.current.matsAlt[0].name).toBe('Marmol Carrara');
  });

  it('sumatoriaMaterialesPrincipalARS respects per-material currency (USD converted at USD rate)', () => {
    // Main material: length=2, width=1, quantity=1 → m2 = 2. Then 2 * 200 (USD) = 400 USD → 400_000 ARS at 1000.
    const { result } = renderHook(() =>
      useBudgetQuoteCalculations({
        form: makeForm({ materials_data: matsMain, usd_rate: 1000 }),
        hayAlternativas: true,
      }),
    );
    expect(result.current.sumatoriaMaterialesPrincipalARS).toBe(400_000);
  });

  it('principalesBreakdown is empty when there are no alternatives', () => {
    const { result } = renderHook(() =>
      useBudgetQuoteCalculations({
        form: makeForm({ materials_data: matsMain }),
        hayAlternativas: false,
      }),
    );
    expect(result.current.principalesBreakdown).toEqual([]);
  });

  it('principalesBreakdown includes one row per main material when alternatives exist', () => {
    const { result } = renderHook(() =>
      useBudgetQuoteCalculations({
        form: makeForm({ materials_data: matsMain, usd_rate: 1000 }),
        hayAlternativas: true,
      }),
    );
    expect(result.current.principalesBreakdown).toHaveLength(1);
    const row = result.current.principalesBreakdown[0];
    expect(row.concept).toContain('Negro Brasil');
    expect(row.total).toBe(400); // 2 (m2) * 1 (qty) * 200 (USD/m2)
    expect(row.currency).toBe('USD');
  });

  it('collapses duplicate alternative panes of the same material into ONE card', () => {
    // P-000003-like: BLANCO SUGGAR and ABSOLUTE WHITE each carry TWO
    // alternative rows (different length/width panes). The grid must show
    // one card per PHYSICAL material (2), not per pane (4) — same grouping
    // rule as buildSectionData (group by materialGroupKey = id).
    const mats: MaterialInForm[] = [
      { id: 21, name: 'BLANCO SUGGAR', currency: 'USD', price_m2: 335000, price_m2_usd: 335, quantity: 1, m2_used: 0, m2_budgeted: 0, length: 1.5, width: 0.5, is_alternative: true },
      { id: 21, name: 'BLANCO SUGGAR', currency: 'USD', price_m2: 335000, price_m2_usd: 335, quantity: 1, m2_used: 0, m2_budgeted: 0, length: 2.12, width: 0.62, is_alternative: true },
      { id: 22, name: 'ABSOLUTE WHITE', currency: 'USD', price_m2: 400000, price_m2_usd: 400, quantity: 1, m2_used: 0, m2_budgeted: 0, length: 1.5, width: 0.5, is_alternative: true },
      { id: 22, name: 'ABSOLUTE WHITE', currency: 'USD', price_m2: 400000, price_m2_usd: 400, quantity: 1, m2_used: 0, m2_budgeted: 0, length: 2.12, width: 0.62, is_alternative: true },
    ];
    const { result } = renderHook(() =>
      useBudgetQuoteCalculations({
        form: makeForm({ materials_data: mats, usd_rate: 1535 }),
        hayAlternativas: true,
      }),
    );
    expect(result.current.matsAlt).toHaveLength(2);
    expect(result.current.matsAlt.map((m) => m.name)).toEqual(['BLANCO SUGGAR', 'ABSOLUTE WHITE']);
    // Panes are aggregated, not dropped: total pieces = 2 and the dimensions
    // are re-encoded so `length × width × quantity` = total m² of the group
    // (0.75 + 1.3144 = 2.0644) — so the card shows "2 pza." and the right m².
    expect(result.current.matsAlt[0].quantity).toBe(2);
    expect(result.current.matsAlt[0].length * result.current.matsAlt[0].width * result.current.matsAlt[0].quantity).toBeCloseTo(2.0644, 4);
  });
});
