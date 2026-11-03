type MeasurementCurrency = 'ARS' | 'USD';

export function budgetedAmounts(
  row: Record<string, unknown>,
  currency: MeasurementCurrency,
  usdRate: number,
): { ars: number | null; usd: number | null } {
  if (currency === 'USD') {
    const usd = Number(row.total_usd_budgeted);
    if (!Number.isFinite(usd)) return { ars: null, usd: null };
    return { ars: usdRate > 0 ? usd * usdRate : 0, usd };
  }

  const ars = Number(row.total_ars_budgeted);
  if (!Number.isFinite(ars)) return { ars: null, usd: null };
  return { ars, usd: usdRate > 0 ? ars / usdRate : 0 };
}
