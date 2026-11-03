import { describe, expect, it } from 'vitest';
import { roundCommercialTotals } from './commercialRounding';

describe('roundCommercialTotals', () => {
  it.each([
    [870000, 870000],
    [869100, 870000],
    [871000, 875000],
    [1021682.5, 1025000],
    [1095688.78, 1100000],
  ])('rounds %s to %s without changing unit prices', (exact, contractual) => {
    const result = roundCommercialTotals(exact, 1500);
    expect(result.contractualArs).toBe(contractual);
    expect(result.exactArs).toBe(Math.round(exact * 100) / 100);
    expect(result.adjustmentArs).toBe(contractual - result.exactArs);
  });

  it('derives contractual USD from contractual ARS', () => {
    const result = roundCommercialTotals(869100, 1500);
    expect(result.contractualArs).toBe(870000);
    expect(result.contractualUsd).toBe(580);
    expect(result.exactUsd).toBe(579.4);
  });

  it('clamps negative and zero totals without producing a negative contract', () => {
    expect(roundCommercialTotals(0, 1500).contractualArs).toBe(0);
    expect(roundCommercialTotals(-100, 1500).contractualArs).toBe(0);
  });
});
