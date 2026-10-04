/**
 * COMPARATIVA DE MEDICIÓN row construction for PDF data.
 *
 * Iterates PIEZA POR PIEZA (e.g. "COCINA" → "PARRILLA"): each piece gets a
 * section-header row followed by its main material + main material rows
 * (tramos) + fabrication details + additional works (assigned to that
 * piece). Three filter rules apply:
 *
 *  1. **Zero-impact filter** — only emit rows where there is a real
 *     dimensional delta OR a real monetary delta. A material with
 *     identical budgeted/real m² and a price that didn't change contributes
 *     nothing and is dropped (cleaner table, no "0,00 / 0,00" noise).
 *  2. **Duplicate annotation** — if a concept (e.g. "Frente Ingletado
 *     45°" or "Zócalo") appears across more than one piece, append the
 *     piece name so the customer sees exactly which one was modified.
 *  3. **Newly added items** — a fabrication/additional row that was
 *     introduced in MEDICIÓN (no `total_*_budgeted` / `m2_budgeted`
 *     snapshot) renders Presupuestado = 0 and Diferencia = +actual, so
 *     the customer sees the real cost of the new line.
 *
 * Mirrors the form's FabricationSection table: M² Real = length × width ×
 * quantity, M² Presupuestado = `m2_budgeted`, Diferencia = real − budgeted.
 * Each row also carries a monetary DIFERENCIA subtotal (ARS + USD): the
 * price of the m² delta `(real − budgeted) × price/m²` in the material's
 * native currency, converted to both currencies with `usdRate`. Zócalos
 * carried at `price: 0` fall back to valuing their M² delta at the linked
 * material's `price_m2` (mirrors the session 2026-09-22 fix).
 */

import { POOL_MATERIAL_GLOBAL } from '../../types/budget';
import type {
  BudgetPiece,
  FabricationDetail,
  MaterialInForm,
} from '../../types/budget';
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
import type { MeasureInfo, SignedMoney } from './buildSectionData.types';

/** Human-readable label for a fabrication concept (BASEBOARD→Zócalo, etc.). */
function fabLabel(conceptCode: string, custom: string, material: string): string {
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
function fabMaterialName(d: FabricationDetail, mainMaterial: MaterialInForm | null): string {
  const fromFab = (d.material || '').trim();
  if (fromFab) return fromFab;
  return mainMaterial?.name || '';
}

/** True when a row has a real dimensional OR monetary impact (vs a no-op
 *  snapshot that didn't change between budget and measurement). The check
 *  is absolute: any non-zero delta on any axis is enough. */
function hasImpact(
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
function sectionHeader(pieceName: string): MeasurementComparisonRow {
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
function materialRow(
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
function detailRow(
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

interface FabContext {
  pieceName: string;
  usdRate: number;
  /** Material currently in scope (price_m2 fallback for price-0 zócalos). */
  material: MaterialInForm;
}

function fabRowFor(
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

interface AddContext {
  pieceName: string;
  usdRate: number;
  material: MaterialInForm;
}

function additionalRowFor(
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

/**
 * Build "COMPARATIVA DE MEDICIÓN" rows from the per-piece tree. One
 * section-header row per piece (in piece order) followed by its material
 * + fabrication + additional rows, all filtered to impactful deltas only.
 *
 * Concept-name de-duplication: scan the whole piece tree first to learn
 * which concept names appear in more than one piece, then annotate
 * those rows with the piece-name suffix. Concepts that only appear in
 * one piece keep their clean label — the customer isn't spammed with
 * "Frente Ingletado 45° - Cocina" if it never showed up anywhere else.
 */
export function buildMeasurementComparison(
  pieces: BudgetPiece[],
  usdRate: number,
): MeasurementComparisonRow[] {
  // Eligibility: a piece contributes rows if it carries at least one of
  // a main material, a tramo, a fabrication row or an additional work.
  // An empty piece emits nothing (no header, no rows) so a budget with
  // ten empty pieces doesn't paint ten useless "PRINCIPAL" headers.
  const eligiblePieces = (pieces || []).filter((p) => {
    const hasMain = p.mainMaterial != null;
    const hasTramo = (p.mainMaterialRows?.length ?? 0) > 0;
    const hasFab = (p.fabrication_details?.length ?? 0) > 0;
    const hasAdd = (() => {
      if (!p.additional_works_data) return false;
      try {
        const parsed = JSON.parse(p.additional_works_data);
        return Array.isArray(parsed) && parsed.length > 0;
      } catch {
        return false;
      }
    })();
    return hasMain || hasTramo || hasFab || hasAdd;
  });
  if (eligiblePieces.length === 0) return [];

  // Pass 1: collect every concept name and the set of pieces it appears
  // in, so the renderer can annotate duplicates with the piece name.
  const conceptToPieces = new Map<string, Set<string>>();
  const collectConcept = (name: string, pieceName: string) => {
    if (!name) return;
    const key = name.toUpperCase();
    const set = conceptToPieces.get(key) ?? new Set<string>();
    set.add(pieceName);
    conceptToPieces.set(key, set);
  };

  // Pre-index fabrication + additional concept names per piece.
  for (const p of eligiblePieces) {
    for (const d of p.fabrication_details || []) {
      const code = String(d.concept || '').trim().toUpperCase();
      if (!code) continue;
      const label = conceptToDisplay(code, d.custom_concept || '');
      // The material suffix is part of the label AS RENDERED, so the
      // dedup key must include it too — otherwise a "Zócalo" on two
      // pieces with the same material name would collapse to one key.
      const rendered = `${label} ${p.mainMaterial?.name || d.material || ''}`.trim();
      collectConcept(rendered, p.name);
    }
    if (p.additional_works_data) {
      let parsed: Array<Record<string, unknown>> = [];
      try {
        const p2 = JSON.parse(p.additional_works_data);
        if (Array.isArray(p2)) parsed = p2 as Array<Record<string, unknown>>;
      } catch { /* malformed JSON, skip */ }
      for (const r of parsed) {
        const rawMat = String(r['materialName'] ?? r['material_name'] ?? '');
        if (!rawMat || rawMat === POOL_MATERIAL_GLOBAL) continue;
        const mat = rawMat.startsWith('__ALT__:') ? rawMat.slice('__ALT__:'.length) : rawMat;
        const name = String(r['name'] || 'Trabajo adicional');
        collectConcept(name, p.name);
        // (mat is kept in scope for the material-match check below)
        void mat;
      }
    }
  }

  // A concept is "shared" if it appears in 2+ pieces.
  const isShared = (name: string): boolean => {
    const key = name.toUpperCase();
    const set = conceptToPieces.get(key);
    return !!set && set.size > 1;
  };

  // Pass 2: emit rows per piece (with the section header).
  const result: MeasurementComparisonRow[] = [];
  for (const p of eligiblePieces) {
    result.push(sectionHeader(p.name));
    const pieceCtx: AddContext = { pieceName: p.name, usdRate, material: p.mainMaterial || ({} as MaterialInForm) };

    // Per-piece dedupe: a single fabrication/additional row (keyed by
    // concept+material+detail+measures) is emitted ONCE per piece, even
    // when several materials inside the same piece share its `material`
    // (e.g. two NEGRO BRASIL mesadas in the same COCINA piece with ONE
    // shared zócalo — the zócalo is the same physical strip, NOT one per
    // mesada). Across pieces the same concept is still allowed to repeat
    // and gets the "Concepto — Pieza" suffix (see `isShared` above).
    const emittedPieceKeys = new Set<string>();
    const pieceDedupeKey = (kind: 'fab' | 'add', row: Record<string, unknown>): string => {
      const concept = kind === 'fab'
        ? String(row['concept'] || row['concepto'] || '').trim().toUpperCase()
        : String(row['name'] || 'Trabajo adicional').trim();
      const material = kind === 'fab'
        ? String(row['material'] || row['material_name'] || '').trim()
        : String(row['materialName'] || row['material_name'] || '').trim()
            .replace(/^__ALT__:/, '');
      const detail = String(row['custom_concept'] || row['detail'] || '').trim();
      const length = Number(row['length'] || 0);
      const width = Number(row['width'] || 0);
      const qty = Number(row['quantity'] || 1);
      return `${kind}|${concept}|${material}|${detail}|${length}|${width}|${qty}`;
    };

    // Main material + tramos.
    const allMaterials: MaterialInForm[] = [];
    if (p.mainMaterial) allMaterials.push(p.mainMaterial);
    if (p.mainMaterialRows) allMaterials.push(...p.mainMaterialRows);
    // Stable sort by material name (es-AR, case-insensitive) so the
    // comparator shows mesadas of the same material contiguously, just
    // like the previous global sort — but bounded to this piece.
    allMaterials.sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' }),
    );
    for (const m of allMaterials) {
      const hasBudget = m.m2_budgeted != null;
      const m2Real = m.length * m.width * m.quantity;
      const m2Budgeted = hasBudget ? Number(m.m2_budgeted || 0) : 0;
      const delta = m2Real - m2Budgeted;
      // Compute subtotals to feed `hasImpact` (the filter).
      const currency: 'ARS' | 'USD' = m.currency === 'USD' ? 'USD' : 'ARS';
      const priceM2 = currency === 'USD' ? Number(m.price_m2_usd || 0) : Number(m.price_m2 || 0);
      const deltaNative = delta * priceM2;
      const subtotalArs = currency === 'ARS' ? deltaNative : usdRate > 0 ? deltaNative * usdRate : 0;
      const subtotalUsd = currency === 'USD' ? deltaNative : usdRate > 0 ? deltaNative / usdRate : 0;
      if (!hasImpact(delta, subtotalArs, subtotalUsd)) continue;
      result.push(materialRow(m, delta, hasBudget, usdRate, p.name));
    }

    // Fabrication details (zocalos / frentes) — scoped to this piece only.
    for (const d of p.fabrication_details || []) {
      const built = fabRowFor(d, { pieceName: p.name, usdRate, material: p.mainMaterial || ({} as MaterialInForm) });
      if (!built) continue;
      if (!hasImpact(built.row.measure_delta ?? null, built.row.subtotal_ars, built.row.subtotal_usd)) continue;
      const dedupeKey = pieceDedupeKey('fab', d as unknown as Record<string, unknown>);
      if (emittedPieceKeys.has(dedupeKey)) continue;
      emittedPieceKeys.add(dedupeKey);
      // Annotate duplicate concept names with the piece-name suffix.
      const code = String(d.concept || '').trim().toUpperCase();
      const baseLabel = code
        ? conceptToDisplay(code, d.custom_concept || '')
        : 'Trabajo de fabricación';
      const materialName = fabMaterialName(d, p.mainMaterial);
      const fullLabel = `${baseLabel} ${materialName}`.trim();
      const finalLabel = isShared(fullLabel)
        ? `${fullLabel} — ${p.name}`
        : built.row.concepto;
      result.push({ ...built.row, concepto: finalLabel });
    }

    // Additional works (frentes + flat) — scoped to this piece only.
    let parsedAdds: Array<Record<string, unknown>> = [];
    if (p.additional_works_data) {
      try {
        const p2 = JSON.parse(p.additional_works_data);
        if (Array.isArray(p2)) parsedAdds = p2 as Array<Record<string, unknown>>;
      } catch { /* malformed */ }
    }
    for (const r of parsedAdds) {
      const rawMat = String(r['materialName'] ?? r['material_name'] ?? '');
      if (!rawMat || rawMat === POOL_MATERIAL_GLOBAL) continue;
      const dedupeKey = pieceDedupeKey('add', r);
      if (emittedPieceKeys.has(dedupeKey)) continue;
      const built = additionalRowFor(r, pieceCtx);
      if (!built) continue;
      if (!hasImpact(built.row.measure_delta ?? null, built.row.subtotal_ars, built.row.subtotal_usd)) continue;
      emittedPieceKeys.add(dedupeKey);
      if (isShared(built.conceptName)) {
        result.push({ ...built.row, concepto: `${built.conceptName} — ${p.name}` });
      } else {
        result.push(built.row);
      }
    }
  }

  return result;
}

/**
 * Resolve the "rendering pieces" the COMPARATIVA DE MEDICIÓN should iterate
 * over. The form may carry:
 *
 *   (a) `form.pieces` already populated (modern WO), or
 *   (b) only the legacy flat arrays (`materials_data` /
 *       `fabrication_details` / `additional_works_data`) — the case of an
 *       API response without `pieces_data` or a test fixture that only
 *       sets the legacy fields.
 *
 * Case (b) is folded into a single piece named "PRINCIPAL" so the
 * comparativa still renders the existing flat data — without the per-
 * piece grouping but with the new filtering + duplicate-annotation
 * behaviour. This is the safe default: tests + legacy imports keep
 * working unchanged; modern WOs get the new per-piece rendering.
 */
function legacyAdditionalWorksFromString(raw: unknown): Array<Record<string, unknown>> {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function legacyMaterialsFromRaw(raw: unknown): MaterialInForm[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as MaterialInForm[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as MaterialInForm[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function resolveRenderingPieces(
  form: { pieces?: unknown; materials_data?: unknown; fabrication_details?: unknown; additional_works_data?: unknown },
): BudgetPiece[] {
  const pieces = (form.pieces as BudgetPiece[] | undefined) ?? [];
  const hasUsablePiece = pieces.some((p) =>
    p.mainMaterial
    || (p.mainMaterialRows?.length ?? 0) > 0
    || (p.fabrication_details?.length ?? 0) > 0
    || (() => {
      if (!p.additional_works_data) return false;
      try {
        const arr = JSON.parse(p.additional_works_data);
        return Array.isArray(arr) && arr.length > 0;
      } catch { return false; }
    })(),
  );
  if (hasUsablePiece) return pieces;
  // Fallback: fold the legacy flat arrays into a single piece so the
  // comparativa still has data to work with. Without this, a form
  // constructed by older test fixtures would render an empty table.
  const flatMaterials = legacyMaterialsFromRaw(form.materials_data);
  const mainMaterials = flatMaterials.filter((m) => !m.is_alternative);
  const altMaterials = flatMaterials.filter((m) => m.is_alternative);
  const fabDetails = (Array.isArray(form.fabrication_details)
    ? form.fabrication_details
    : []) as FabricationDetail[];
  const adicionales = legacyAdditionalWorksFromString(form.additional_works_data);
  // If there's no legacy data either, return the empty pieces list as-is.
  if (
    mainMaterials.length === 0
    && altMaterials.length === 0
    && fabDetails.length === 0
    && adicionales.length === 0
  ) {
    return pieces;
  }
  return [
    {
      id: 'legacy-folded',
      name: 'PRINCIPAL',
      mainMaterial: mainMaterials[0] ?? null,
      mainMaterialRows: mainMaterials.slice(1),
      alternativeMaterials: altMaterials,
      fabrication_details: fabDetails,
      additional_works_data: JSON.stringify(adicionales),
      pools: [],
    },
  ];
}
