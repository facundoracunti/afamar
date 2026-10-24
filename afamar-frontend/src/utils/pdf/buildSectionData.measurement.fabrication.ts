/**
 * COMPARATIVA DE MEDICIÓN — fabrication rows (zócalo / frente).
 *
 * Extracted from `buildSectionData.measurement.ts` (which stays the public
 * orchestrator). Turns one `FabricationDetail` into a detail row of the
 * comparison table, resolving its dimensional snapshot (m² / ml) and its
 * monetary delta.
 */

import type { FabricationDetail, MaterialInForm } from '../../types/budget';
import type { MeasurementComparisonRow } from './pdfTypes';
import { M2_CONCEPTS, LINEAR_CONCEPTS, fmtMoney } from './pdfHelpers';
import { detailRow, fabLabel, fabMaterialName } from './buildSectionData.measurement.rows';

export interface FabContext {
  pieceName: string;
  usdRate: number;
  /** Material currently in scope (price_m2 fallback for price-0 zócalos). */
  material: MaterialInForm;
}

export function fabRowFor(
  d: FabricationDetail,
  ctx: FabContext,
): { row: MeasurementComparisonRow; isNew: boolean } | null {
  const fdCurrency: 'ARS' | 'USD' = (d.currency || 'ARS') === 'USD' ? 'USD' : 'ARS';
  const fdLength = Number(d.length || 0);
  const fdWidth = Number(d.width || 0);
  const fdQty = Number(d.quantity || 1);
  const conceptCode = String(d.concept || '').trim().toUpperCase();
  if (!conceptCode) return null;
  // The "newly added" signal: no dimensional snapshot AND no monetary
  // snapshot on the WO row → it didn't exist at conversion time. We treat
  // it as a brand-new line item (Presupuestado = 0, Diferencia = +real,
  // Subtotal = the new cost in full).
  const isNew =
    d.m2_budgeted == null
    && d.linear_meters_budgeted == null
    && d.total_ars_budgeted == null
    && d.total_usd_budgeted == null;
  let fdMeasureUnit: 'm2' | 'ml' | null = null;
  let fdMeasureReal: number | null = null;
  let fdMeasureBudgeted: number | null = null;
  if (M2_CONCEPTS.has(conceptCode)) {
    fdMeasureUnit = 'm2';
    fdMeasureReal = fdLength * fdWidth * fdQty;
    fdMeasureBudgeted = d.m2_budgeted ?? null;
  } else if (LINEAR_CONCEPTS.has(conceptCode)) {
    fdMeasureUnit = 'ml';
    fdMeasureReal = fdLength * fdQty;
    fdMeasureBudgeted = d.linear_meters_budgeted ?? null;
  }
  const fdMeasureDelta =
    fdMeasureUnit && fdMeasureReal != null && fdMeasureBudgeted != null
      ? fdMeasureReal - fdMeasureBudgeted
      : isNew && fdMeasureReal != null
        ? fdMeasureReal
        : null;
  // Monetary delta. For a NEW row the delta equals the FULL current cost
  // (no pre-existing quote to subtract from). For an EXISTING row the
  // delta is the current cost minus the budgeted snapshot, with the
  // price-0 → m² fallback when the row is billed through the base material.
  const materialCurrency: 'ARS' | 'USD' = (ctx.material.currency || 'ARS') === 'USD' ? 'USD' : 'ARS';
  const priceM2 = materialCurrency === 'USD'
    ? Number(ctx.material.price_m2_usd || 0)
    : Number(ctx.material.price_m2 || 0);
  const lineTotal = Number(d.price || 0) * Number(d.quantity || 1);
  let deltaArs: number;
  let deltaUsd: number;
  if (isNew) {
    // Newly added: full line cost counts as the comparison delta (the
    // customer owes this new line item; the original quote was 0).
    const lineArs = fdCurrency === 'ARS' ? lineTotal : ctx.usdRate > 0 ? lineTotal * ctx.usdRate : 0;
    const lineUsd = fdCurrency === 'USD' ? lineTotal : ctx.usdRate > 0 ? lineTotal / ctx.usdRate : 0;
    deltaArs = lineArs;
    deltaUsd = lineUsd;
  } else if (
    lineTotal === 0
    && fdMeasureUnit === 'm2'
    && fdMeasureDelta != null
    && priceM2 > 0
  ) {
    const deltaNative = fdMeasureDelta * priceM2;
    deltaArs = materialCurrency === 'ARS' ? deltaNative : ctx.usdRate > 0 ? deltaNative * ctx.usdRate : 0;
    deltaUsd = materialCurrency === 'USD' ? deltaNative : ctx.usdRate > 0 ? deltaNative / ctx.usdRate : 0;
  } else {
    const lineArs = fdCurrency === 'ARS' ? lineTotal : ctx.usdRate > 0 ? lineTotal * ctx.usdRate : 0;
    const lineUsd = fdCurrency === 'USD' ? lineTotal : ctx.usdRate > 0 ? lineTotal / ctx.usdRate : 0;
    const budgetedDelta = (current: number, budgeted: number | undefined | null): number =>
      budgeted == null ? 0 : current - budgeted;
    deltaArs = budgetedDelta(lineArs, d.total_ars_budgeted);
    deltaUsd = budgetedDelta(lineUsd, d.total_usd_budgeted);
  }
  return {
    row: detailRow(
      fabLabel(conceptCode, d.custom_concept || '', fabMaterialName(d, ctx.material)),
      deltaArs,
      deltaUsd,
      ((v) => `${v > 0 ? '+' : ''}${fmtMoney(v)}`),
      { unit: fdMeasureUnit, real: fdMeasureReal, budgeted: fdMeasureBudgeted, delta: fdMeasureDelta },
      ctx.pieceName,
    ),
    isNew,
  };
}
