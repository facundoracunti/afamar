/**
 * COMPARATIVA DE MEDICIÓN row construction for PDF data.
 *
 * Thin orchestrator: the row factories live in
 * `buildSectionData.measurement.rows`, the fabrication rows in
 * `buildSectionData.measurement.fabrication`, the additional works rows in
 * `buildSectionData.measurement.additional` and the legacy flat-array
 * resolution in `buildSectionData.measurement.legacy`. This module keeps the
 * public API (`buildMeasurementComparison` / `resolveRenderingPieces`) so
 * every consumer and test keeps importing from the same path.
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
 */

import { POOL_MATERIAL_GLOBAL } from '../../types/budget';
import type { BudgetPiece, MaterialInForm } from '../../types/budget';
import type { MeasurementComparisonRow } from './pdfTypes';
import { conceptToDisplay } from './pdfHelpers';
import {
  fabMaterialName,
  hasImpact,
  materialRow,
  sectionHeader,
} from './buildSectionData.measurement.rows';
import { fabRowFor } from './buildSectionData.measurement.fabrication';
import { additionalRowFor } from './buildSectionData.measurement.additional';
import type { AddContext } from './buildSectionData.measurement.additional';

export { resolveRenderingPieces } from './buildSectionData.measurement.legacy';

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
