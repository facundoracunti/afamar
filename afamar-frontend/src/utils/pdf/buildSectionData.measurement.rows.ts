/**
 * COMPARATIVA DE MEDICIÓN — row factories.
 *
 * Extracted from `buildSectionData.measurement.ts` (which stays the public
 * orchestrator). These are the pure builders that turn a material / a
 * fabrication / an additional work into a `MeasurementComparisonRow`
 * (section header, material row, detail row) plus the shared label + impact
 * helpers.
 *
 * Mirrors the form's FabricationSection table: M² Real = length × width ×
 * quantity, M² Presupuestado = `m2_budgeted`, Diferencia = real − budgeted.
 * Each row also carries a monetary DIFERENCIA subtotal (ARS + USD): the
 * price of the m² delta `(real − budgeted) × price/m²` in the material's
 * native currency, converted to both currencies with `usdRate`. Zócalos
 * carried at `price: 0` fall back to valuing their M² delta at the linked
 * material's `price_m2` (mirrors the session 2026-09-22 fix).
 */

import type { FabricationDetail, MaterialInForm } from '../../types/budget';
import type { MeasurementComparisonRow } from './pdfTypes';
import {
  fmtMoney,
  fmtNum,
  fmtMeasure,
  conceptToDisplay,
} from './pdfHelpers';
import type { MeasureInfo, SignedMoney } from './buildSectionData.types';

/** Human-readable label for a fabrication concept (BASEBOARD→Zócalo, etc.). */
export function fabLabel(conceptCode: string, custom: string, material: string): string {
  const baseLabel = conceptCode
    ? conceptToDisplay(conceptCode, custom)
    : 'Trabajo de fabricación';
  return `${baseLabel} ${material}`.trim();
}

/** Material name for the fabrication label. Prefers the fabrication's own
 *  `material` field (the match key) over the piece's main material — the
 *  fabrication row was tied to a SPECIFIC material and the label must
 *  reflect that. Falls back to the piece main material only when the
 *  fabrication row carries no `material` at all (legacy budgets). */
export function fabMaterialName(d: FabricationDetail, mainMaterial: MaterialInForm | null): string {
  const fromFab = (d.material || '').trim();
  if (fromFab) return fromFab;
  return mainMaterial?.name || '';
}

/** True when a row has a real dimensional OR monetary impact (vs a no-op
 *  snapshot that didn't change between budget and measurement). The check
 *  is absolute: any non-zero delta on any axis is enough. */
export function hasImpact(
  deltaMeasure: number | null | undefined,
  subtotalArs: number,
  subtotalUsd: number,
): boolean {
  if (deltaMeasure != null && Math.abs(deltaMeasure) > 1e-6) return true;
  if (Math.abs(subtotalArs) > 0.005) return true;
  if (Math.abs(subtotalUsd) > 0.005) return true;
  return false;
}

/** Build a section-header row (emitted once per piece). The renderer
 *  recognises `is_section_header` and skips the numeric cells. */
export function sectionHeader(pieceName: string): MeasurementComparisonRow {
  return {
    concepto: pieceName,
    m2_budgeted: null,
    m2_real: 0,
    delta: null,
    m2_budgeted_str: '',
    m2_real_str: '',
    delta_str: '',
    subtotal_ars: 0,
    subtotal_usd: 0,
    subtotal_ars_str: '',
    subtotal_usd_str: '',
    measure_budgeted: null,
    measure_real: null,
    measure_delta: null,
    measure_unit: null,
    measure_budgeted_str: '',
    measure_real_str: '',
    measure_delta_str: '',
    piece_name: pieceName,
    is_section_header: true,
  };
}

/** Build a material row (one per piece's main material + each tramo). */
export function materialRow(
  m: MaterialInForm,
  delta: number,
  hasBudget: boolean,
  usdRate: number,
  pieceName: string,
): MeasurementComparisonRow {
  const currency: 'ARS' | 'USD' = m.currency === 'USD' ? 'USD' : 'ARS';
  const priceM2 = currency === 'USD' ? Number(m.price_m2_usd || 0) : Number(m.price_m2 || 0);
  const m2Real = m.length * m.width * m.quantity;
  const m2Budgeted = hasBudget ? Number(m.m2_budgeted || 0) : 0;
  const deltaMatNative = delta * priceM2;
  // Newly added (no `m2_budgeted` snapshot): the row counts its FULL m²
  // cost against the comparativa, since the customer owes that line
  // outright (no pre-existing quote to deduct from). The "—" → "0" change
  // is what makes the difference between "I added 0,5 m²" and "0,5 m²
  // appeared out of nowhere" visible to the operator.
  const subtotalArs = currency === 'ARS'
    ? deltaMatNative
    : usdRate > 0 ? deltaMatNative * usdRate : 0;
  const subtotalUsd = currency === 'USD'
    ? deltaMatNative
    : usdRate > 0 ? deltaMatNative / usdRate : 0;
  const signed = (v: number): string => `${v > 0 ? '+' : ''}${fmtMoney(v)}`;
  return {
    concepto: m.name || '',
    m2_budgeted: m2Budgeted,
    m2_real: m2Real,
    delta,
    m2_budgeted_str: hasBudget ? fmtNum(m2Budgeted, 2) : '0,00',
    m2_real_str: fmtNum(m2Real, 2),
    delta_str: hasBudget
      ? `${delta > 0 ? '+' : ''}${fmtNum(delta, 2)}`
      : `+${fmtNum(m2Real, 2)}`,
    subtotal_ars: subtotalArs,
    subtotal_usd: subtotalUsd,
    subtotal_ars_str: hasBudget ? signed(subtotalArs) : signed(subtotalArs),
    subtotal_usd_str: signed(subtotalUsd),
    measure_budgeted: m2Budgeted,
    measure_real: m2Real,
    measure_delta: delta,
    measure_unit: 'm2',
    measure_budgeted_str: hasBudget ? `${fmtNum(m2Budgeted, 2)} m²` : '0,00 m²',
    measure_real_str: `${fmtNum(m2Real, 2)} m²`,
    measure_delta_str: `${delta > 0 ? '+' : ''}${fmtNum(delta, 2)} m²`,
    piece_name: pieceName,
  };
}

/** Build a fabrication / additional detail row (m² or ml). */
export function detailRow(
  label: string,
  ars: number,
  usd: number,
  signed: SignedMoney,
  measure: MeasureInfo,
  pieceName: string,
): MeasurementComparisonRow {
  const unit = measure.unit;
  const unitLabel = unit ? (unit === 'm2' ? 'm²' : 'ml') : null;
  // Presupuestado cell: when the measure exists but the budgeted value
  // is missing (newly added item), render "0,00 m²" / "0,00 ml" so the
  // customer can see a numeric zero instead of a blank cell — the row
  // is a "newly added" line item, not a legacy missing-snapshot case.
  const measureBudgeted = (v: number | null, sign = false): string => {
    if (v == null || !unitLabel) {
      if (measure.real != null && measure.budgeted == null && unitLabel) {
        return unit === 'm2' ? `0,00 ${unitLabel}` : `0 ${unitLabel}`;
      }
      return '';
    }
    const body = unit === 'm2' ? fmtNum(v, 2) : fmtMeasure(v);
    const signedBody = sign ? `${v > 0 ? '+' : ''}${body}` : body;
    return `${signedBody} ${unitLabel}`;
  };
  return {
    concepto: label,
    m2_budgeted: null,
    m2_real: 0,
    delta: null,
    m2_budgeted_str: measure.real != null && measure.budgeted == null && unitLabel
      ? '0,00'
      : '',
    m2_real_str: '',
    delta_str: '',
    subtotal_ars: ars,
    subtotal_usd: usd,
    subtotal_ars_str: signed(ars),
    subtotal_usd_str: signed(usd),
    is_detail: true,
    measure_budgeted: measure.budgeted,
    measure_real: measure.real,
    measure_delta: measure.delta,
    measure_unit: unit,
    measure_budgeted_str: measureBudgeted(measure.budgeted),
    measure_real_str: measureBudgeted(measure.real),
    measure_delta_str: measureBudgeted(measure.delta, true),
    piece_name: pieceName,
  };
}
