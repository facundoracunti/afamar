/**
 * Revaluation helpers for PDF section-data construction.
 *
 * A GLOBAL (unassigned) zócalo/frente row has no material of its own, so it
 * ships with a $0 stored subtotal. Every section that quotes a material —
 * the PRINCIPAL and each ALTERNATIVA — re-values those rows against that
 * section's own material price; alternativas additionally reprice ANY m² /
 * frente row (even one frozen against the principal) with their own
 * material. These functions encode that rule.
 */

import type { MaterialInForm } from '../../types/budget';
import { FRENTE_LINEAR_COEFFICIENT, FRENTE_FORMULA_MULTIPLIER_DEFAULT } from '../frentePricing';
import type { PdfDataRow, AdditionalWorkPdfRow } from './pdfTypes';
import { fmtMoney } from './pdfHelpers';

/** Price per m² of an alternative's material in its own currency. */
function priceM2ForMaterial(alt: MaterialInForm): number {
  return alt.currency === 'USD'
    ? Number(alt.price_m2_usd ?? 0)
    : Number(alt.price_m2 ?? 0);
}

/**
 * Revalue a GLOBAL (unassigned) m² fabrication row — typically a ZÓCALO —
 * against a specific section's material. An unassigned m² row has no
 * material to derive its price from (stored price 0, hence "sin ningún
 * valor" in the PDF). Since the row is folded into EVERY section (PRINCIPAL
 * and each ALTERNATIVA), we give each section its own valuation using that
 * section's material price per m². Non-m² rows and already-valued rows
 * pass through unchanged.
 */
export function revalueGlobalFabricationForMaterial(
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
    price_per_m2_str: fmtMoney(priceM2ForMaterial(alt)),
    subtotal_ars: subtotalArs,
    subtotal_usd: subtotalUsd,
  };
}

/**
 * Re-value ANY m² fabrication row against a specific alternative's material
 * — the HOJA DE ALTERNATIVAS rule. Unlike `revalueGlobalFabricationForMaterial`
 * (which only rewrites unassigned $0 rows), this re-prices EVERY m² concept
 * (ZÓCALO / FRENTE / BASEBOARD / FRONT) with the alternative's own material
 * price per m²: `Precio = m² × precio_m2_del_material_de_la_alternativa`.
 * Without this, a zócalo/frente authored against the PRINCIPAL (with a
 * frozen price and material) would render inside each alternative carrying
 * the principal's price while only its `material` label is swapped. Non-m²
 * rows (linear work, traforos, etc.) pass through unchanged.
 */
export function revalueM2FabricationForMaterial(
  row: PdfDataRow,
  alt: MaterialInForm,
  usdRate: number,
): PdfDataRow {
  const m2 = row.m2;
  if (!row.show_m2 || m2 == null || m2 <= 0) return row;
  const price = Math.round(m2 * priceM2ForMaterial(alt) * 100) / 100;
  const currency: 'ARS' | 'USD' = alt.currency === 'USD' ? 'USD' : 'ARS';
  const subtotalArs = currency === 'USD' ? price * usdRate : price;
  const subtotalUsd = currency === 'USD' ? price : (usdRate > 0 ? price / usdRate : 0);
  return {
    ...row,
    material: alt.name,
    currency,
    price_str: fmtMoney(price),
    price_per_m2_str: fmtMoney(priceM2ForMaterial(alt)),
    subtotal_ars: subtotalArs,
    subtotal_usd: subtotalUsd,
  };
}

/**
 * Revalue a global FRENTE (additional work row of type `frente`) against a
 * specific section's material. A frente left in "GLOBAL - SUMA AL TOTAL" has
 * no material of its own (`assigned_material_id` null → price/total 0); it
 * should take the value of the section's material (PRINCIPAL or each
 * ALTERNATIVA), mirroring the ZÓCALO behaviour. Linked frontes that already
 * carry a value (or aren't frontes / have no linear meters) pass through.
 */
export function revalueGlobalFrenteForMaterial(
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
 * Revalue EVERY `frente` additional-work row against a specific
 * alternative's material — the HOJA DE ALTERNATIVAS rule. Unlike
 * `revalueGlobalFrenteForMaterial` (which only rewrites the unvalued $0
 * rows), this re-prices ANY frente with the alternative's own $/m²
 * (`ml × price_m2 × 0.13 × 1.15`), even when the row carries a frozen
 * subtotal authored against the PRINCIPAL — a frente shown inside an
 * ALTERNATIVA must quote the ALTERNATIVE's price, not the frozen one.
 * The breakdown strings are refreshed so the "Calculado:" line follows.
 * Non-frente rows pass through unchanged.
 */
export function revalueFrenteForMaterial(
  row: AdditionalWorkPdfRow,
  alt: MaterialInForm,
  usdRate: number,
): AdditionalWorkPdfRow {
  if (row.type !== 'frente') return row;
  const ml = Number(row.linear_meters || 0);
  if (ml <= 0) return row;
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
    material_price_per_m2_str: fmtMoney(pricePerM2),
    formula_constant_str: fmtMoney(multiplier),
    subtotal_ars: subtotalArs,
    subtotal_usd: subtotalUsd,
  };
}