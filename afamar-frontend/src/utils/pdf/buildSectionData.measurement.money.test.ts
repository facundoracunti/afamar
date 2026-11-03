import { describe, expect, it } from 'vitest';
import { budgetedAmounts } from './buildSectionData.measurement.money';

describe('budgetedAmounts', () => {
  it('uses the USD snapshot and the frozen order rate for USD rows', () => {
    expect(budgetedAmounts({ total_usd_budgeted: 102.71, total_ars_budgeted: 160227.6 }, 'USD', 1550)).toEqual({
      ars: 159200.5,
      usd: 102.71,
    });
  });

  it('keeps ARS snapshots native without using a USD snapshot', () => {
    expect(budgetedAmounts({ total_ars_budgeted: 50000, total_usd_budgeted: 32 }, 'ARS', 1550)).toEqual({
      ars: 50000,
      usd: 32.25806451612903,
    });
  });

  it('does not fall back to a mismatched ARS snapshot for USD rows', () => {
    expect(budgetedAmounts({ total_ars_budgeted: 160227.6 }, 'USD', 1550)).toEqual({ ars: null, usd: null });
  });
});
