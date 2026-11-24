/** Silent commercial rounding shared by the live form and its payload. */
export interface CommercialTotals {
  exactArs: number;
  exactUsd: number;
  adjustmentArs: number;
  adjustmentUsd: number;
  contractualArs: number;
  contractualUsd: number;
}

export function roundCommercialTotals(exactArs: number, usdRate: number): CommercialTotals {
  const exactCents = Math.max(0, Math.round((Number(exactArs) || 0) * 100));
  const unitCents = 5000 * 100;
  const contractualCents = Math.ceil(exactCents / unitCents) * unitCents;
  const exact = exactCents / 100;
  const contractual = contractualCents / 100;
  const rate = Number(usdRate) || 0;
  const exactUsd = rate > 0 ? Math.round((exact / rate) * 100) / 100 : 0;
  const contractualUsd = rate > 0 ? Math.round((contractual / rate) * 100) / 100 : 0;
  return {
    exactArs: exact,
    exactUsd,
    adjustmentArs: contractual - exact,
    adjustmentUsd: Math.round((contractualUsd - exactUsd) * 100) / 100,
    contractualArs: contractual,
    contractualUsd,
  };
}

/**
 * Apply the commercial rule to every piece before aggregating the budget.
 * This keeps the document total equal to the visible piece subtotals.
 */
export function roundCommercialPieceTotals(
  exactPieceArs: number[],
  usdRate: number,
): CommercialTotals {
  const exactArs = exactPieceArs.reduce((sum, value) => sum + (Number(value) || 0), 0);
  const roundedPieces = exactPieceArs.reduce(
    (sum, value) => sum + roundCommercialTotals(value, usdRate).contractualArs,
    0,
  );
  const rate = Number(usdRate) || 0;
  const exactUsd = rate > 0 ? Math.round((exactArs / rate) * 100) / 100 : 0;
  const contractualUsd = rate > 0 ? Math.round((roundedPieces / rate) * 100) / 100 : 0;
  return {
    exactArs,
    exactUsd,
    adjustmentArs: roundedPieces - exactArs,
    adjustmentUsd: Math.round((contractualUsd - exactUsd) * 100) / 100,
    contractualArs: roundedPieces,
    contractualUsd,
  };
}
