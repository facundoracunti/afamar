/**
 * COMPARATIVA DE MEDICIÓN row construction for PDF data.
 *
 * Mirrors the form's FabricationSection table: M² Real =
 * length × width × quantity, M² Presupuestado = `m2_budgeted`, Diferencia
 * = real − budgeted. Each row also carries a monetary DIFERENCIA subtotal
 * plus any linked zócalo/frente as indented detail rows.
 */

import { POOL_MATERIAL_GLOBAL } from '../../types/budget';
import type { MaterialInForm } from '../../types/budget';
import type { MeasurementComparisonRow } from './pdfTypes';
import {
  M2_CONCEPTS,
  LINEAR_CONCEPTS,
  fmtMoney,
  fmtNum,
  fmtMeasure,
  conceptToDisplay,
  parseJsonList,
} from './pdfHelpers';
import type { FabricationComparisonItem, MeasureInfo, SignedMoney } from './buildSectionData.types';

/** Build an indented detail row (zócalo/frente) with its monetary delta and,
 *  when available, its unit-aware measure columns (m² / ml). */
function detailRow(
  label: string,
  ars: number,
  usd: number,
  signed: SignedMoney,
  measure: MeasureInfo,
): MeasurementComparisonRow {
  const unit = measure.unit;
  const unitLabel = unit ? (unit === 'm2' ? 'm²' : 'ml') : null;
  const measureStr = (v: number | null, sign = false): string => {
    if (v == null || !unitLabel) return '';
    // M² must show exactly 2 decimals (customer-facing); ml keeps the compact
    // measure formatting (`3 ml`, `3.3 ml`).
    const body = unit === 'm2' ? fmtNum(v, 2) : fmtMeasure(v);
    const signedBody = sign ? `${v > 0 ? '+' : ''}${body}` : body;
    return `${signedBody} ${unitLabel}`;
  };
  return {
    concepto: label,
    m2_budgeted: null,
    m2_real: 0,
    delta: null,
    m2_budgeted_str: '',
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
    measure_budgeted_str: measureStr(measure.budgeted),
    measure_real_str: measureStr(measure.real),
    measure_delta_str: measureStr(measure.delta, true),
  };
}

/**
 * Build "COMPARATIVA DE MEDICIÓN" rows from the main materials (work
 * orders only). Mirrors the form's FabricationSection table: M² Real =
 * length × width × quantity, M² Presupuestado = `m2_budgeted`, Diferencia
 * = real − budgeted. Only rows with a real m² or a budget are returned.
 *
 * Each row also carries a monetary DIFERENCIA subtotal (ARS + USD): the
 * price of the m² delta `(real − budgeted) × price/m²` in the material's
 * native currency, converted to both currencies with `usdRate`, plus the
 * monetary delta of any linked zócalo/frente (fabrication_details +
 * additional_works) whose `material` / `materialName` matches this
 * material's name. The per-row delta of a linked row is
 * `subtotal_actual − total_*_budgeted` (snapshot taken at conversion),
 * so it also captures measure (M²/ML) and material re-assignment changes.
 * Zócalos carried at `price: 0` (billed through the base material's m²)
 * fall back to valuing their M² delta at the linked material's `price_m2`
 * — the price × qty formula would otherwise always delta to $0 and hide
 * the financial impact of a measured drift.
 * Global / unmatched zócalo-frente rows are ignored. Uses the same
 * conversion convention as `buildMaterialRows`.
 */
export function buildMeasurementComparison(
  materials: MaterialInForm[],
  usdRate: number,
  fabricationRaw?: unknown,
  additionalRaw?: unknown,
): MeasurementComparisonRow[] {
  // Group pieces by material name so the comparison table renders
  // contiguously: all CARRARA rows (and their indented zócalos) together,
  // then all CARAVELLAS WHITE rows — even when the operator entered them
  // interleaved (CARAVELLAS WHITE, CARRARA, CARAVELLAS WHITE). Chosen over
  // section-header rows: the material row already acts as its group title.
  // Stable sort preserves the input order inside each group, and linked
  // zócalos/frentes still emit indented directly under their own piece.
  const mainMaterials = (materials || [])
    .filter((m) => !m.is_alternative)
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' }));
  if (mainMaterials.length === 0) return [];

  const budgetedDelta = (current: number, budgeted: number | undefined | null): number =>
    budgeted == null ? 0 : current - budgeted;
  const signedMoney = (v: number): string => `${v > 0 ? '+' : ''}${fmtMoney(v)}`;

  // Raw linked rows (zócalo/frente) from both sources, matched against the
  // material's name below.
  const fabricationActual = parseJsonList(fabricationRaw) as FabricationComparisonItem[];
  const additionalActual = parseJsonList(additionalRaw) as Array<Record<string, unknown>>;

  const result: MeasurementComparisonRow[] = [];
  // Tracks the additional_work_id (or name fallback) of catalogue frentes
  // already emitted as a detail row, so a single item that matches
  // multiple materials (e.g. one frente assigned to NEGRO BRASIL covering
  // two mesadas) is rendered exactly once. See the dedupe comment above.
  const emittedFrenteKeys = new Set<string>();
  // Same dedupe for fabrication rows (zócalos): a single row is emitted
  // EXACTLY ONCE across the comparison. When several pieces share the same
  // material name (e.g. four NEGRO BRASIL mesadas) and the operator
  // assigned ONE zócalo to that material, the name-based match below would
  // otherwise paint the row under EVERY piece (`d.material === name` holds
  // for each one). The key identifies the work item — concept + material +
  // detail + measures — so distinct strips stay visible while one row no
  // longer repeats.
  const emittedZocaloKeys = new Set<string>();

  for (const m of mainMaterials) {
    const length = Number(m.length || 0);
    const width = Number(m.width || 0);
    const quantity = m.quantity || 1;
    const m2Real = length * width * quantity;
    const m2Budgeted = Number(m.m2_budgeted || 0);
    const hasBudget = m2Budgeted > 0;
    const delta = m2Real - m2Budgeted;

    const currency: 'ARS' | 'USD' = m.currency === 'USD' ? 'USD' : 'ARS';
    const priceM2 = currency === 'USD' ? Number(m.price_m2_usd || 0) : Number(m.price_m2 || 0);
    const name = m.name || '';
    const deltaMatNative = delta * priceM2;
    // Subtotal is the *delta* in monetary terms: `(real − budgeted) × price`.
    // When the row has no `m2_budgeted` snapshot (legacy orders, converted
    // before the dimensional-snapshot feature, or re-frozen rows) the cell
    // is rendered as "—" so the customer doesn't see a misleading value.
    // We MUST also keep `subtotal_ars` / `subtotal_usd` at zero so the
    // `comparisonRowsWithTotal` sum doesn't include the orphan and inflate
    // the TOTAL row. Otherwise a 1.395 m² BLANCO SUGGAR with no budgeted
    // baseline would add the FULL material price ($717.343,88) to the
    // comparison TOTAL even though the row visually shows no contribution.
    const subtotal_ars = hasBudget
      ? currency === 'ARS' ? deltaMatNative : usdRate > 0 ? deltaMatNative * usdRate : 0
      : 0;
    const subtotal_usd = hasBudget
      ? currency === 'USD' ? deltaMatNative : usdRate > 0 ? deltaMatNative / usdRate : 0
      : 0;

    // Only pushed when the material has at least a quoted m² or a real m².
    if (m2Real > 0 || m2Budgeted > 0) {
      result.push({
        concepto: name,
        m2_budgeted: hasBudget ? m2Budgeted : null,
        m2_real: m2Real,
        delta: hasBudget ? delta : null,
        m2_budgeted_str: hasBudget ? fmtNum(m2Budgeted, 2) : '',
        m2_real_str: fmtNum(m2Real, 2),
        delta_str: hasBudget
          ? `${delta > 0 ? '+' : ''}${fmtNum(delta, 2)}`
          : '',
        subtotal_ars,
        subtotal_usd,
        subtotal_ars_str: hasBudget ? signedMoney(subtotal_ars) : '',
        subtotal_usd_str: hasBudget ? signedMoney(subtotal_usd) : '',
        measure_budgeted: hasBudget ? m2Budgeted : null,
        measure_real: m2Real,
        measure_delta: hasBudget ? delta : null,
        measure_unit: 'm2',
        measure_budgeted_str: hasBudget ? `${fmtNum(m2Budgeted, 2)} m²` : '',
        measure_real_str: `${fmtNum(m2Real, 2)} m²`,
        measure_delta_str: hasBudget ? `${delta > 0 ? '+' : ''}${fmtNum(delta, 2)} m²` : '',
      });
    }

    // Indented detail rows — zócalo/frente from the fabrication table.
    for (const d of fabricationActual || []) {
      if (typeof d !== 'object' || d == null) continue;
      const mat = (d.material || '').trim();
      if (!mat || mat !== name) continue;
      const conceptCode = String(d.concept || d.concepto || '').trim().toUpperCase();
      const custom = String(d.custom_concept || '').trim();
      const baseLabel = conceptCode
        ? conceptToDisplay(conceptCode, custom)
        : 'Trabajo de fabricación';
      const label = `${baseLabel} ${name}`.trim();
      // Measure unit follows the concept (mirroring buildFabricationRows):
      // m² for zócalos/frentes/regrueso, ml for linear work (TERMINACION). The
      // budgeted measure is the `m2_budgeted` / `linear_meters_budgeted`
      // snapshot taken at conversion; legacy rows without it show '—'.
      const fdLength = Number(d.length || 0);
      const fdWidth = Number(d.width || 0);
      const fdQty = Number(d.quantity || 1);
      // Dedupe the zócalo like frentes: ONE fabrication row emitted once
      // across the whole comparison, keyed by the work item itself
      // (concept + material + detail + measures). Without this, a single
      // "Zócalo NEGRO BRASIL" matches every main material named NEGRO
      // BRASIL and gets painted under each piece.
      const zocaloKey = `${conceptCode}|${mat}|${String(d.custom_concept || d.detail || '').trim()}|${fdLength}|${fdWidth}|${fdQty}`;
      if (emittedZocaloKeys.has(zocaloKey)) continue;
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
          : null;
      // Monetary delta of the zócalo/frente. Default: current total minus the
      // `total_*_budgeted` snapshot taken at conversion. Fallback reserved for
      // zócalos carried at `price: 0` (billed through the base material's m²):
      // the price × qty formula would always delta to $0, hiding the financial
      // impact of a real-vs-budgeted m² drift. When the row has no unit price
      // but the measure delta exists, value it at the linked material's
      // `price_m2` (native currency, converted with `usdRate` — same
      // convention as the material row above).
      const fdCurrency: 'ARS' | 'USD' = d.currency === 'USD' ? 'USD' : 'ARS';
      const lineTotal = Number(d.price || 0) * Number(d.quantity || 1);
      let deltaArs: number;
      let deltaUsd: number;
      if (
        lineTotal === 0 &&
        fdMeasureUnit === 'm2' &&
        fdMeasureDelta != null &&
        priceM2 > 0
      ) {
        const deltaNative = fdMeasureDelta * priceM2;
        deltaArs = currency === 'ARS' ? deltaNative : usdRate > 0 ? deltaNative * usdRate : 0;
        deltaUsd = currency === 'USD' ? deltaNative : usdRate > 0 ? deltaNative / usdRate : 0;
      } else {
        const lineArs = fdCurrency === 'ARS' ? lineTotal : usdRate > 0 ? lineTotal * usdRate : 0;
        const lineUsd = fdCurrency === 'USD' ? lineTotal : usdRate > 0 ? lineTotal / usdRate : 0;
        deltaArs = budgetedDelta(lineArs, d.total_ars_budgeted);
        deltaUsd = budgetedDelta(lineUsd, d.total_usd_budgeted);
      }
      emittedZocaloKeys.add(zocaloKey);
      result.push(
        detailRow(label, deltaArs, deltaUsd, signedMoney, {
          unit: fdMeasureUnit,
          real: fdMeasureReal,
          budgeted: fdMeasureBudgeted,
          delta: fdMeasureDelta,
        }),
      );
    }

    // Indented detail rows — frentes/adicionales from the catalogue, assigned
    // to this material (globals are shown separately and are excluded here).
    //
    // Dedupe rule: a single `additional_work_id` (or `name` fallback) is
    // emitted EXACTLY ONCE across the whole comparison, even when its
    // `materialName` matches multiple main materials (e.g. one "Frente
    // Ingletetado 45°" assigned to NEGRO BRASIL covers two mesadas — we
    // draw it once under whichever material matches first, not twice).
    // This mirrors the business reality that frentes are billed in TOTAL
    // METROS LINEALES, not per mesada.
    for (const row of additionalActual || []) {
      if (typeof row !== 'object' || row == null) continue;
      const rawMat = (row['materialName'] ?? row['material_name'] ?? '') as string;
      if (!rawMat || rawMat === POOL_MATERIAL_GLOBAL) continue;
      const mat = rawMat.startsWith('__ALT__:') ? rawMat.slice('__ALT__:'.length) : rawMat;
      if (mat !== name) continue;
      const dedupeKey = String(
        row['additional_work_id'] ?? row['name'] ?? '',
      );
      if (!dedupeKey) continue;
      if (emittedFrenteKeys.has(dedupeKey)) continue;
      const awCurrency: 'ARS' | 'USD' = row['currency'] === 'USD' ? 'USD' : 'ARS';
      const price = Number(row['price']) || 0;
      const quantity = Number(row['quantity']) || 1;
      const totalSrc = Number(row['total']) || price * quantity;
      const lineArs = awCurrency === 'ARS' ? totalSrc : usdRate > 0 ? totalSrc * usdRate : 0;
      const lineUsd = awCurrency === 'USD' ? totalSrc : usdRate > 0 ? totalSrc / usdRate : 0;
      const deltaArs = budgetedDelta(lineArs, row['total_ars_budgeted'] as number | undefined | null);
      const deltaUsd = budgetedDelta(lineUsd, row['total_usd_budgeted'] as number | undefined | null);
      const label = String(row['name'] || 'Trabajo adicional');
      // Frentes are measured in ml; flat works carry no measure at all.
      const isFrente = String(row['type'] || '').toLowerCase() === 'frente';
      const awMeasureReal = isFrente ? (Number(row['linear_meters']) || null) : null;
      const awMeasureBudgeted = isFrente
        ? ((row['linear_meters_budgeted'] as number | undefined | null) ?? null)
        : null;
      const awMeasureDelta =
        isFrente && awMeasureReal != null && awMeasureBudgeted != null
          ? awMeasureReal - awMeasureBudgeted
          : null;
      emittedFrenteKeys.add(dedupeKey);
      result.push(
        detailRow(label, deltaArs, deltaUsd, signedMoney, {
          unit: isFrente ? 'ml' : null,
          real: awMeasureReal,
          budgeted: awMeasureBudgeted,
          delta: awMeasureDelta,
        }),
      );
    }
  }

  return result;
}