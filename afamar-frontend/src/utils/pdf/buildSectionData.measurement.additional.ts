/**
 * COMPARATIVA DE MEDICIÓN — additional works rows (frentes / flat).
 *
 * Extracted from `buildSectionData.measurement.ts` (which stays the public
 * orchestrator). Turns one entry of `additional_works_data` into a detail
 * row of the comparison table, resolving its dimensional snapshot (ml for
 * frentes) and its monetary delta.
 */

import { POOL_MATERIAL_GLOBAL } from '../../types/budget';
import type { MaterialInForm } from '../../types/budget';
import type { MeasurementComparisonRow } from './pdfTypes';
import { fmtMoney } from './pdfHelpers';
import { detailRow } from './buildSectionData.measurement.rows';

export interface AddContext {
  pieceName: string;
  usdRate: number;
  material: MaterialInForm;
}

export function additionalRowFor(
  row: Record<string, unknown>,
  ctx: AddContext,
): { row: MeasurementComparisonRow; isNew: boolean; conceptName: string } | null {
  const rawMat = String(row['materialName'] ?? row['material_name'] ?? '');
  if (!rawMat || rawMat === POOL_MATERIAL_GLOBAL) return null;
  // Match the SAME material name (the main material of the piece). The
  // additional work's `materialName` should equal that material so the
  // work is shown in the piece's block. If it doesn't match (e.g. an
  // additional work assigned to a different material of the same piece)
  // we still emit it: the customer wants to see the delta regardless of
  // which material it's billed against.
  const isNew =
    row['linear_meters_budgeted'] == null
    && row['total_ars_budgeted'] == null
    && row['total_usd_budgeted'] == null;
  const awCurrency: 'ARS' | 'USD' = row['currency'] === 'USD' ? 'USD' : 'ARS';
  const price = Number(row['price']) || 0;
  const quantity = Number(row['quantity']) || 1;
  const totalSrc = Number(row['total']) || price * quantity;
  let lineArs: number;
  let lineUsd: number;
  if (isNew) {
    lineArs = awCurrency === 'ARS' ? totalSrc : ctx.usdRate > 0 ? totalSrc * ctx.usdRate : 0;
    lineUsd = awCurrency === 'USD' ? totalSrc : ctx.usdRate > 0 ? totalSrc / ctx.usdRate : 0;
  } else {
    lineArs = awCurrency === 'ARS' ? totalSrc : ctx.usdRate > 0 ? totalSrc * ctx.usdRate : 0;
    lineUsd = awCurrency === 'USD' ? totalSrc : ctx.usdRate > 0 ? totalSrc / ctx.usdRate : 0;
  }
  const budgetedDelta = (current: number, budgeted: number | undefined | null): number =>
    budgeted == null ? 0 : current - budgeted;
  const deltaArs = isNew
    ? lineArs
    : budgetedDelta(lineArs, row['total_ars_budgeted'] as number | undefined | null);
  const deltaUsd = isNew
    ? lineUsd
    : budgetedDelta(lineUsd, row['total_usd_budgeted'] as number | undefined | null);
  const isFrente = String(row['type'] || '').toLowerCase() === 'frente';
  const awMeasureReal = isFrente ? (Number(row['linear_meters']) || null) : null;
  const awMeasureBudgeted = isFrente
    ? ((row['linear_meters_budgeted'] as number | undefined | null) ?? null)
    : null;
  const awMeasureDelta =
    isFrente && awMeasureReal != null && awMeasureBudgeted != null
      ? awMeasureReal - awMeasureBudgeted
      : isFrente && awMeasureReal != null
        ? awMeasureReal
        : null;
  const conceptName = String(row['name'] || 'Trabajo adicional');
  return {
    row: detailRow(
      conceptName,
      deltaArs,
      deltaUsd,
      ((v) => `${v > 0 ? '+' : ''}${fmtMoney(v)}`),
      { unit: isFrente ? 'ml' : null, real: awMeasureReal, budgeted: awMeasureBudgeted, delta: awMeasureDelta },
      ctx.pieceName,
    ),
    isNew,
    conceptName,
  };
}
