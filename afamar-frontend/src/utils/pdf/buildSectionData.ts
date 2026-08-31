/**
 * Row builders and section bucketing for PDF data construction.
 */

import { POOL_MATERIAL_GLOBAL } from '../../types/budget';
import { materialGroupKey } from '../materialGroups';
import type { MaterialInForm } from '../../types/budget';
import { FRENTE_LINEAR_COEFFICIENT, FRENTE_FORMULA_MULTIPLIER_DEFAULT } from '../frentePricing';
import type {
  PoolInForm,
  PdfDataRow,
  MaterialPdfRow,
  PoolPdfRow,
  AdditionalWorkPdfRow,
  MaterialSection,
  MeasurementComparisonRow,
} from './pdfTypes';
import {
  M2_CONCEPTS,
  UNIT_CONCEPTS,
  LINEAR_CONCEPTS,
  fmtMoney,
  fmtMeasure,
  fmtMeasureUnit,
  conceptToDisplay,
  parseJsonList,
} from './pdfHelpers';

export function buildFabricationRows(raw: unknown, usdRate: number): PdfDataRow[] {
  const items = parseJsonList(raw) as Array<{
    concept?: string;
    custom_concept?: string;
    length?: number;
    width?: number;
    quantity?: number;
    price?: number;
    currency?: string;
    detail?: string;
    material?: string;
    labor?: number;
  }>;
  if (!items || items.length === 0) return [];
  const result: PdfDataRow[] = [];
  for (const d of items) {
    const conceptCode = (d.concept || '').toUpperCase();
    const custom = (d.custom_concept || '').trim();
    const length = Number(d.length || 0);
    const width = Number(d.width || 0);
    const quantity = Number(d.quantity || 1);
    const price = Number(d.price || 0);
    const currency: 'ARS' | 'USD' = d.currency === 'USD' ? 'USD' : 'ARS';

    const isM2 = M2_CONCEPTS.has(conceptCode);
    const isUnit = UNIT_CONCEPTS.has(conceptCode);
    const isLinear = LINEAR_CONCEPTS.has(conceptCode);
    const showLength = isM2 || isLinear || length > 0;
    const showWidth = isM2 || width > 0;
    const showM2 = isM2;
    const showQuantity = isM2 || isUnit || quantity > 0;
    const m2Value = isM2 ? Math.round(length * width * quantity * 100000000) / 100000000 : null;

    const lineTotal = price * quantity;
    const subtotalArs = currency === 'ARS' ? lineTotal : usdRate > 0 ? lineTotal * usdRate : 0;
    const subtotalUsd = currency === 'USD' ? lineTotal : usdRate > 0 ? lineTotal / usdRate : 0;

    const labor = Number(d.labor || 0);

    result.push({
      concept: conceptToDisplay(conceptCode, custom),
      detail: d.detail || '',
      material: d.material || '',
      show_length: showLength,
      show_width: showWidth,
      show_m2: showM2,
      show_quantity: showQuantity,
      length_str: showLength && length ? fmtMeasureUnit(length, 'm') : null,
      width_str: showWidth && width ? fmtMeasureUnit(width, 'm') : null,
      m2_label: isUnit ? 'U' : isM2 ? fmtMeasure(m2Value) : null,
      quantity: Number.isInteger(quantity) ? quantity : quantity,
      currency,
      price_str: fmtMoney(price),
      labor_str: conceptCode === 'OTHER' && labor > 0 ? fmtMoney(labor) : null,
      subtotal_ars: subtotalArs,
      subtotal_usd: subtotalUsd,
      m2: isM2 ? m2Value : null,
    });
  }
  return result;
}

export function buildMaterialRows(materials: MaterialInForm[], usdRate: number): MaterialPdfRow[] {
  const result: MaterialPdfRow[] = [];
  for (const src of materials) {
    const length = Number(src.length || 0);
    const width = Number(src.width || 0);
    const quantity = Number(src.quantity || 1);
    const m2 = length * width * quantity;
    const currency: 'ARS' | 'USD' = src.currency === 'USD' ? 'USD' : 'ARS';
    const priceM2Ars = Number(src.price_m2 || 0);
    const priceM2Usd = Number(src.price_m2_usd || 0);
    const subtotalOriginal = currency === 'USD'
      ? m2 * priceM2Usd
      : m2 * priceM2Ars;
    const subtotalArs = currency === 'ARS' ? subtotalOriginal : usdRate > 0 ? subtotalOriginal * usdRate : 0;
    const subtotalUsd = currency === 'USD' ? subtotalOriginal : usdRate > 0 ? subtotalOriginal / usdRate : 0;
    const priceM2 = currency === 'USD' ? priceM2Usd : priceM2Ars;
    result.push({
      name: src.name || '',
      color: src.color || '',
      length_str: fmtMeasureUnit(length, 'm'),
      width_str: fmtMeasureUnit(width, 'm'),
      quantity: Number.isInteger(quantity) ? quantity : quantity,
      m2_str: fmtMeasure(Math.round(m2 * 100000000) / 100000000),
      price_m2_str: fmtMoney(priceM2),
      subtotal_str: fmtMoney(subtotalOriginal),
      currency,
      subtotal_ars: subtotalArs,
      subtotal_usd: subtotalUsd,
    });
  }
  return result;
}

export function buildPoolRows(pools: PoolInForm[], usdRate: number): PoolPdfRow[] {
  const result: PoolPdfRow[] = [];
  for (const p of pools) {
    const quantity = Number(p.quantity || 1);
    const currency: 'ARS' | 'USD' = p.currency === 'USD' ? 'USD' : 'ARS';
    const priceOriginal = Number(p.price || 0);
    const subtotalOriginal = priceOriginal * quantity;
    const subtotalArs = currency === 'ARS' ? subtotalOriginal : usdRate > 0 ? subtotalOriginal * usdRate : 0;
    const subtotalUsd = currency === 'USD' ? subtotalOriginal : usdRate > 0 ? subtotalOriginal / usdRate : 0;
    result.push({
      brand: p.brand || '',
      model: p.model || '',
      quantity: Number.isInteger(quantity) ? quantity : quantity,
      price_str: fmtMoney(priceOriginal),
      subtotal_str: fmtMoney(subtotalOriginal),
      currency,
      subtotal_ars: subtotalArs,
      subtotal_usd: subtotalUsd,
      material: p.material || '',
    });
  }
  return result;
}

export function asMaterials(raw: unknown): MaterialInForm[] {
  return (parseJsonList(raw) as MaterialInForm[]).filter(Boolean);
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
 * Global / unmatched zócalo-frente rows are ignored. Uses the same
 * conversion convention as `buildMaterialRows`.
 */
export function buildMeasurementComparison(
  materials: MaterialInForm[],
  usdRate: number,
  fabricationRaw?: unknown,
  additionalRaw?: unknown,
): MeasurementComparisonRow[] {
  const mainMaterials = (materials || []).filter((m) => !m.is_alternative);
  if (mainMaterials.length === 0) return [];

  const budgetedDelta = (current: number, budgeted: number | undefined | null): number =>
    budgeted == null ? 0 : current - budgeted;
  const signedMoney = (v: number): string => `${v > 0 ? '+' : ''}${fmtMoney(v)}`;

  // Raw linked rows (zócalo/frente) from both sources, matched against the
  // material's name below.
  const fabricationActual = parseJsonList(fabricationRaw) as Array<{
    concept?: string;
    concepto?: string;
    custom_concept?: string;
    currency?: string;
    price?: number;
    quantity?: number;
    length?: number;
    width?: number;
    material?: string;
    m2_budgeted?: number | null;
    linear_meters_budgeted?: number | null;
    total_ars_budgeted?: number | null;
    total_usd_budgeted?: number | null;
  }>;
  const additionalActual = parseJsonList(additionalRaw) as Array<Record<string, unknown>>;

  const result: MeasurementComparisonRow[] = [];

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
        m2_budgeted_str: hasBudget ? fmtMeasure(m2Budgeted) : '',
        m2_real_str: fmtMeasure(m2Real),
        delta_str: hasBudget
          ? `${delta > 0 ? '+' : ''}${fmtMeasure(delta)}`
          : '',
        subtotal_ars,
        subtotal_usd,
        subtotal_ars_str: hasBudget ? signedMoney(subtotal_ars) : '',
        subtotal_usd_str: hasBudget ? signedMoney(subtotal_usd) : '',
        measure_budgeted: hasBudget ? m2Budgeted : null,
        measure_real: m2Real,
        measure_delta: hasBudget ? delta : null,
        measure_unit: 'm2',
        measure_budgeted_str: hasBudget ? `${fmtMeasure(m2Budgeted)} m²` : '',
        measure_real_str: `${fmtMeasure(m2Real)} m²`,
        measure_delta_str: hasBudget ? `${delta > 0 ? '+' : ''}${fmtMeasure(delta)} m²` : '',
      });
    }

    // Indented detail rows — zócalo/frente from the fabrication table.
    for (const d of fabricationActual || []) {
      if (typeof d !== 'object' || d == null) continue;
      const mat = (d.material || '').trim();
      if (!mat || mat !== name) continue;
      const fdCurrency: 'ARS' | 'USD' = d.currency === 'USD' ? 'USD' : 'ARS';
      const lineTotal = Number(d.price || 0) * Number(d.quantity || 1);
      const lineArs = fdCurrency === 'ARS' ? lineTotal : usdRate > 0 ? lineTotal * usdRate : 0;
      const lineUsd = fdCurrency === 'USD' ? lineTotal : usdRate > 0 ? lineTotal / usdRate : 0;
      const deltaArs = budgetedDelta(lineArs, d.total_ars_budgeted);
      const deltaUsd = budgetedDelta(lineUsd, d.total_usd_budgeted);
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
    for (const row of additionalActual || []) {
      if (typeof row !== 'object' || row == null) continue;
      const rawMat = (row['materialName'] ?? row['material_name'] ?? '') as string;
      if (!rawMat || rawMat === POOL_MATERIAL_GLOBAL) continue;
      const mat = rawMat.startsWith('__ALT__:') ? rawMat.slice('__ALT__:'.length) : rawMat;
      if (mat !== name) continue;
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

/** Build an indented detail row (zócalo/frente) with its monetary delta and,
 *  when available, its unit-aware measure columns (m² / ml). */
function detailRow(
  label: string,
  ars: number,
  usd: number,
  signed: (v: number) => string,
  measure: {
    unit: 'm2' | 'ml' | null;
    real: number | null;
    budgeted: number | null;
    delta: number | null;
  },
): MeasurementComparisonRow {
  const unit = measure.unit;
  const unitLabel = unit ? (unit === 'm2' ? 'm²' : 'ml') : null;
  const measureStr = (v: number | null, sign = false): string => {
    if (v == null || !unitLabel) return '';
    const body = sign ? `${v > 0 ? '+' : ''}${fmtMeasure(v)}` : fmtMeasure(v);
    return `${body} ${unitLabel}`;
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

export function asPools(raw: unknown): PoolInForm[] {
  return (parseJsonList(raw) as PoolInForm[]).filter(Boolean);
}

/** Price per m² of an alternative's material in its own currency. */
function priceM2ForMaterial(alt: MaterialInForm): number {
  return alt.currency === 'USD'
    ? Number(alt.price_m2_usd ?? 0)
    : Number(alt.price_m2 ?? 0);
}

/**
 * Revalue a GLOBAL (unassigned) m² fabrication row — typically a ZÓCALO —
 * against a specific option's material. In an alternatives-only budget an
 * unassigned m² row has no material to derive its price from (stored price
 * 0, hence "sin ningún valor" in the PDF). Since the row is folded into
 * EVERY option, we give each option its own valuation using that option's
 * material price per m². Non-m² rows and already-valued rows pass through
 * unchanged.
 */
function revalueGlobalFabricationForMaterial(
  row: PdfDataRow,
  alt: MaterialInForm,
  usdRate: number,
): PdfDataRow {
  const m2 = row.m2;
  if (!row.show_m2 || m2 == null || m2 <= 0 || row.material) return row;
  if (row.subtotal_ars !== 0 || row.subtotal_usd !== 0) return row;
  const price = Math.round(m2 * priceM2ForMaterial(alt) * 100) / 100;
  const currency: 'ARS' | 'USD' = alt.currency === 'USD' ? 'USD' : 'ARS';
  const subtotalArs = currency === 'USD' ? price * usdRate : price;
  const subtotalUsd = currency === 'USD' ? price : (usdRate > 0 ? price / usdRate : 0);
  return {
    ...row,
    material: alt.name,
    currency,
    price_str: fmtMoney(price),
    subtotal_ars: subtotalArs,
    subtotal_usd: subtotalUsd,
  };
}

/**
 * Revalue a global FRENTE (additional work row of type `frente`) against a
 * specific option's material. A frente left in "GLOBAL - SUMA AL TOTAL" has
 * no material of its own (`assigned_material_id` null → price/total 0); in
 * an alternatives-only budget it should take the value of each option's
 * material, mirroring the ZÓCALO behaviour. Linked frontes that already
 * carry a value (or aren't frontes / have no linear meters) pass through.
 */
function revalueGlobalFrenteForMaterial(
  row: AdditionalWorkPdfRow,
  alt: MaterialInForm,
  usdRate: number,
): AdditionalWorkPdfRow {
  if (row.type !== 'frente') return row;
  const ml = Number(row.linear_meters || 0);
  if (ml <= 0) return row;
  if (row.subtotal_ars !== 0 || row.subtotal_usd !== 0) return row;
  const multiplier =
    row.multiplier != null && Number.isFinite(row.multiplier) && Number(row.multiplier) > 0
      ? Number(row.multiplier)
      : FRENTE_FORMULA_MULTIPLIER_DEFAULT;
  const pricePerM2 = priceM2ForMaterial(alt);
  const total =
    Math.round(pricePerM2 * FRENTE_LINEAR_COEFFICIENT * multiplier * ml * 100) / 100;
  const pricePerMeter =
    Math.round(pricePerM2 * FRENTE_LINEAR_COEFFICIENT * multiplier * 100) / 100;
  const currency: 'ARS' | 'USD' = alt.currency === 'USD' ? 'USD' : 'ARS';
  const subtotalArs = currency === 'USD' ? total * usdRate : total;
  const subtotalUsd = currency === 'USD' ? total : (usdRate > 0 ? total / usdRate : 0);
  return {
    ...row,
    currency,
    price_str: fmtMoney(pricePerMeter),
    subtotal_ars: subtotalArs,
    subtotal_usd: subtotalUsd,
  };
}

/**
 * Group materials, pools and fabrication details into per-option sections.
 */
export function buildSections(
  allMaterials: MaterialInForm[],
  alternatives: MaterialInForm[],
  pools: PoolInForm[],
  fabricationRows: PdfDataRow[],
  usdRate: number,
  addicionalBuckets: {
    additionalByMaterial: Record<string, AdditionalWorkPdfRow[]>;
    additionalCommon: AdditionalWorkPdfRow[];
  } = { additionalByMaterial: {}, additionalCommon: [] },
): { sections: MaterialSection[]; flatMaterials: MaterialPdfRow[]; flatPools: PoolPdfRow[]; flatFabrication: PdfDataRow[]; subtotalMain: number; subtotalGlobal: number } {
  const mainMaterials = allMaterials.filter((m) => !m.is_alternative);
  const flatMaterials: MaterialPdfRow[] = [];
  const flatPools: PoolPdfRow[] = [];
  const flatFabrication: PdfDataRow[] = [];
  const sections: MaterialSection[] = [];

  const mainMaterialRows = buildMaterialRows(mainMaterials, usdRate);
  const allPoolRows = buildPoolRows(pools, usdRate);

  const poolsByMaterial: Record<string, PoolPdfRow[]> = {};
  const poolsCommon: PoolPdfRow[] = [];
  for (const poolRow of allPoolRows) {
    const linkedMaterial = poolRow.material;
    if (!linkedMaterial || linkedMaterial === POOL_MATERIAL_GLOBAL) {
      poolsCommon.push(poolRow);
    } else {
      if (!poolsByMaterial[linkedMaterial]) poolsByMaterial[linkedMaterial] = [];
      poolsByMaterial[linkedMaterial].push(poolRow);
    }
  }

  const fabricationByMaterial: Record<string, PdfDataRow[]> = {};
  const fabricationCommon: PdfDataRow[] = [];
  for (const row of fabricationRows) {
    const detailMaterial = row.material;
    if (detailMaterial && detailMaterial.length > 0) {
      if (!fabricationByMaterial[detailMaterial]) fabricationByMaterial[detailMaterial] = [];
      fabricationByMaterial[detailMaterial].push(row);
    } else {
      fabricationCommon.push(row);
    }
  }

  // Main section
  const hasMain = mainMaterials.length > 0;

  // Alternatives-only budget (no principal, ≥1 alternative): global zócalos /
  // globales frentes take each option's own material value (see revaluation
  // helpers used in the alternative loop below).
  const revalueForOptions = !hasMain && alternatives.length > 0;

  const uniqueMainNames = [...new Set(mainMaterials.map((m) => m.name))];
  const mainFabrication: PdfDataRow[] = [...fabricationCommon];
  for (const name of uniqueMainNames) {
    if (fabricationByMaterial[name]) {
      mainFabrication.push(...fabricationByMaterial[name]);
    }
  }
  const mainPoolRows: PoolPdfRow[] = [...poolsCommon];
  for (const name of uniqueMainNames) {
    if (poolsByMaterial[name]) {
      mainPoolRows.push(...poolsByMaterial[name]);
    }
  }
  const mainAdditional: AdditionalWorkPdfRow[] = [
    ...addicionalBuckets.additionalCommon,
  ];
  for (const name of uniqueMainNames) {
    if (addicionalBuckets.additionalByMaterial[name]) {
      mainAdditional.push(...addicionalBuckets.additionalByMaterial[name]);
    }
  }
  const mainAdditionArs = mainAdditional.reduce((s, a) => s + a.subtotal_ars, 0);
  const mainAdditionUsd = mainAdditional.reduce((s, a) => s + a.subtotal_usd, 0);
  let mainSubtotalArs =
    mainMaterialRows.reduce((s, r) => s + r.subtotal_ars, 0) +
    mainPoolRows.reduce((s, r) => s + r.subtotal_ars, 0) +
    mainFabrication.reduce((s, r) => s + r.subtotal_ars, 0) +
    mainAdditionArs;
  let mainSubtotalUsd =
    mainMaterialRows.reduce((s, r) => s + r.subtotal_usd, 0) +
    mainPoolRows.reduce((s, r) => s + r.subtotal_usd, 0) +
    mainFabrication.reduce((s, r) => s + r.subtotal_usd, 0) +
    mainAdditionUsd;
  const mainName = mainMaterials.length === 1 ? mainMaterials[0].name : '';

  // Alternatives — group rows by physical material (catalogue `id`, falling
  // back to the name for legacy rows) so a material with several panes
  // collapses into ONE option section, mirroring the MaterialCard grouping
  // in the form UI. Without this, each `materials_data` row of the same
  // alternative spawned its own "ALTERNATIVA N" section.
  const builtAlternatives: MaterialSection[] = [];
  const altGroups = new Map<string, MaterialInForm[]>();
  for (const alt of alternatives) {
    const groupKey = materialGroupKey(alt);
    const group = altGroups.get(groupKey);
    if (group) group.push(alt);
    else altGroups.set(groupKey, [alt]);
  }
  let altIdx = 0;
  for (const [, altGroup] of altGroups) {
    const representative = altGroup[0];
    const altMaterialRows = buildMaterialRows(altGroup, usdRate);
    // Alternatives-only budget: a GLOBAL (unassigned) m² fabrication row
    // (ZÓCALO) and a GLOBAL frente have no material of their own, so they
    // render "sin ningún valor" ($0). Fold them into each option revalued
    // with THAT option's material price. When a principal exists the global
    // extras keep their stored value in every section (existing behaviour).
    const altFabrication: PdfDataRow[] = revalueForOptions
      ? [
          ...fabricationCommon.map((f) => revalueGlobalFabricationForMaterial(f, representative, usdRate)),
          ...(fabricationByMaterial[representative.name] ?? []),
        ]
      : [
          ...fabricationCommon,
          ...(fabricationByMaterial[representative.name] ?? []),
        ];
    const altPools: PoolPdfRow[] = [
      ...poolsCommon,
      ...(poolsByMaterial[representative.name] ?? []),
    ];
    const altAdditional: AdditionalWorkPdfRow[] = revalueForOptions
      ? [
          ...addicionalBuckets.additionalCommon.map((a) => revalueGlobalFrenteForMaterial(a, representative, usdRate)),
          ...(addicionalBuckets.additionalByMaterial[representative.name] ?? []).map((a) =>
            a.type === 'frente' && a.subtotal_ars === 0 && a.subtotal_usd === 0
              ? revalueGlobalFrenteForMaterial(a, representative, usdRate)
              : a,
          ),
        ]
      : [
          ...addicionalBuckets.additionalCommon,
          ...(addicionalBuckets.additionalByMaterial[representative.name] ?? []),
        ];
    const altAdditionArs = altAdditional.reduce((s, a) => s + a.subtotal_ars, 0);
    const altAdditionUsd = altAdditional.reduce((s, a) => s + a.subtotal_usd, 0);
    const altSubtotalArs =
      altMaterialRows.reduce((s, r) => s + r.subtotal_ars, 0) +
      altPools.reduce((s, r) => s + r.subtotal_ars, 0) +
      altFabrication.reduce((s, r) => s + r.subtotal_ars, 0) +
      altAdditionArs;
    const altSubtotalUsd =
      altMaterialRows.reduce((s, r) => s + r.subtotal_usd, 0) +
      altPools.reduce((s, r) => s + r.subtotal_usd, 0) +
      altFabrication.reduce((s, r) => s + r.subtotal_usd, 0) +
      altAdditionUsd;
    builtAlternatives.push({
      title: `ALTERNATIVA ${altIdx + 1}: ${representative.name}`,
      is_main: false,
      is_global: false,
      alternative_index: altIdx,
      material_name: representative.name,
      materials: altMaterialRows,
      pools: altPools,
      fabrication_details: altFabrication,
      additional_works: altAdditional,
      subtotal_ars: altSubtotalArs,
      subtotal_usd: altSubtotalUsd,
    });
    altIdx += 1;
  }

  if (hasMain) {
    sections.push({
      title: `PRINCIPAL${mainName ? `: ${mainName}` : ''}`,
      is_main: true,
      is_global: false,
      material_name: mainName,
      materials: mainMaterialRows,
      pools: mainPoolRows,
      fabrication_details: mainFabrication,
      additional_works: mainAdditional,
      subtotal_ars: mainSubtotalArs,
      subtotal_usd: mainSubtotalUsd,
    });
    flatMaterials.push(...mainMaterialRows);
    flatPools.push(...mainPoolRows);
    flatFabrication.push(...mainFabrication);
    sections.push(...builtAlternatives);
    for (const a of builtAlternatives) {
      flatMaterials.push(...a.materials);
      flatPools.push(...a.pools);
      flatFabrication.push(...a.fabrication_details);
    }
  } else {
    // No main material. The alternatives below already fold in the common
    // pool / fabrication / additional rows (poolsCommon, additionalCommon,
    // fabricationCommon), so a separate "GLOBAL" section would only
    // duplicate them. Only when there are NO alternatives at all do we need
    // a synthetic GLOBAL section so a pileta marked "no material" or a
    // traforo isn't dropped (no option page would otherwise carry it).
    if (builtAlternatives.length === 0) {
      const globalSubtotalArs =
        mainPoolRows.reduce((s, r) => s + r.subtotal_ars, 0) +
        mainFabrication.reduce((s, r) => s + r.subtotal_ars, 0) +
        mainAdditional.reduce((s, a) => s + a.subtotal_ars, 0);
      const globalSubtotalUsd =
        mainPoolRows.reduce((s, r) => s + r.subtotal_usd, 0) +
        mainFabrication.reduce((s, r) => s + r.subtotal_usd, 0) +
        mainAdditional.reduce((s, a) => s + a.subtotal_usd, 0);
      if (mainPoolRows.length || mainFabrication.length || mainAdditional.length) {
        sections.push({
          title: 'GLOBAL',
          is_main: false,
          is_global: true,
          material_name: '',
          materials: [],
          pools: mainPoolRows,
          fabrication_details: mainFabrication,
          additional_works: mainAdditional,
          subtotal_ars: globalSubtotalArs,
          subtotal_usd: globalSubtotalUsd,
        });
      }
    }
    flatPools.push(...mainPoolRows);
    flatFabrication.push(...mainFabrication);
    sections.push(...builtAlternatives);
    for (const a of builtAlternatives) {
      flatMaterials.push(...a.materials);
      flatPools.push(...a.pools);
      flatFabrication.push(...a.fabrication_details);
    }

    // No main material but at least one alternative: the document-level
    // "principal" subtotal (returned as `subtotalMain`) defaults to the FIRST
    // alternative — the app-wide convention mirrored by `useBudgetCalculations`
    // and `_recalculate_totals_from_items` — i.e. its material cost plus all
    // the common pool / fabrication / additional items.
    if (builtAlternatives.length > 0) {
      mainSubtotalArs = builtAlternatives[0].subtotal_ars;
      mainSubtotalUsd = builtAlternatives[0].subtotal_usd;
    }
  }

  return {
    sections,
    flatMaterials,
    flatPools,
    flatFabrication,
    subtotalMain: mainSubtotalArs,
    subtotalGlobal: 0,
  };
}
