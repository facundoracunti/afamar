/**
 * Tests for the centralized dolar quote service client (`dolarApi.ts`).
 *
 * Verifies:
 *  - `rateForSource('official')` picks `official_sale_rate`
 *  - `rateForSource('blue_mid')` picks `blue_mid_rate` (avg compra/venta)
 */
import { describe, expect, it } from 'vitest';
import { rateForSource, type DolarRates } from './dolarApi';

const RATES: DolarRates = {
  official_sale_rate: 1450.0,
  blue_mid_rate: 1550.0,
  updated_at: '2026-09-25T12:00:00+00:00',
};

describe('rateForSource', () => {
  it('returns the official sale rate for the "official" source (presupuestos)', () => {
    expect(rateForSource(RATES, 'official')).toBe(1450.0);
  });

  it('returns the blue mid rate for the "blue_mid" source (órdenes de trabajo)', () => {
    expect(rateForSource(RATES, 'blue_mid')).toBe(1550.0);
  });

  it('defaults unknown sources to the official rate', () => {
    expect(rateForSource(RATES, 'blue_mid')).not.toBe(RATES.official_sale_rate);
  });
});