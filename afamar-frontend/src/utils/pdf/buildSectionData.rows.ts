/**
 * Pure row transformers for PDF section-data construction.
 *
 * Each function converts one raw form slice (or an already-built row array)
 * into its PDF row form. They carry no state and no UI concerns — they are
 * shared verbatim by the legacy flat document builder and the multi-piece
 * builder so both price and format identically.
 */

import { POOL_MATERIAL_GLOBAL } from '../../types/budget';
import type { MaterialInForm } from '../../types/budget';
import { FRENTE_FORMULA_MULTIPLIER_DEFAULT } from '../frentePricing';
import type {
  PoolInForm,
  PdfDataRow,
  MaterialPdfRow,
  PoolPdfRow,
  AdditionalWorkPdfRow,
} from './pdfTypes';
import {
  M2_CONCEPTS,
  UNIT_CONCEPTS,
  LINEAR_CONCEPTS,
  fmtMoney,
  fmtNum,
  fmtMeasureUnit,
  conceptToDisplay,
  parseJsonList,
} from './pdfHelpers';
import type { FabricationRawItem, AdditionalBuckets } from './buildSectionData.types';

export function asMaterials(raw: unknown): MaterialInForm[] {
  return (parseJsonList(raw) as MaterialInForm[]).filter(Boolean);
}

export function asPools(raw: unknown): PoolInForm[] {
  return (parseJsonList(raw) as PoolInForm[]).filter(Boolean);
}

export function buildFabricationRows(raw: unknown, usdRate: number): PdfDataRow[] {
  const items = parseJsonList(raw) as FabricationRawItem[];
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
      m2_label: isUnit ? 'U' : isM2 ? fmtNum(m2Value, 2) : null,
      quantity: Number.isInteger(quantity) ? quantity : quantity,
      currency,
      price_str: fmtMoney(price),
      price_per_m2_str:
        isM2 && length > 0 && width > 0
          ? fmtMoney(Math.round((price / (length * width)) * 100) / 100)
          : null,
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
      m2_str: fmtNum(Math.round(m2 * 100000000) / 100000000, 2),
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

/**
 * Build the `AdditionalWorkPdfRow[]` from a form slice's
 * `additional_works_data` (JSON string or already-parsed array). Shared by
 * the legacy flat document builder and the multi-piece builder so both
 * price the frente formula identically.
 */
export function buildAdditionalWorksRows(
  form: Record<string, unknown>,
  usdRate: number,
): AdditionalWorkPdfRow[] {
  const additionalWorksRaw = (form as { additional_works_data?: unknown }).additional_works_data;
  let additionalWorksParsed: Array<Record<string, unknown>> = [];
  if (typeof additionalWorksRaw === 'string' && additionalWorksRaw) {
    try {
      const parsed = JSON.parse(additionalWorksRaw);
      if (Array.isArray(parsed)) {
        additionalWorksParsed = parsed as Array<Record<string, unknown>>;
      }
    } catch {
      // Malformed JSON → render as empty.
    }
  } else if (Array.isArray(additionalWorksRaw)) {
    additionalWorksParsed = additionalWorksRaw as Array<Record<string, unknown>>;
  }

  return additionalWorksParsed.map((row) => {
    const name = String(row['name'] ?? '');
    const detail = (row['detail'] as string | null | undefined) ?? null;
    const currency = (row['currency'] === 'USD' ? 'USD' : 'ARS') as 'ARS' | 'USD';
    const price = Number(row['price']) || 0;
    const quantity = Number(row['quantity']) || 1;
    const totalInSourceCurrency = Number(row['total']) || (price * quantity);
    const rowType: 'flat' | 'frente' = row['type'] === 'frente' ? 'frente' : 'flat';
    const formulaValues = (row['formula_values'] as Record<string, unknown> | null | undefined) ?? null;
    const rawMaterialName = (row['materialName'] ?? row['material_name'] ?? '') as string;
    const material_name = rawMaterialName && rawMaterialName !== POOL_MATERIAL_GLOBAL
      ? rawMaterialName
      : POOL_MATERIAL_GLOBAL;
    const rawAssignedId = row['assigned_material_id'];
    const assigned_material_id = rawAssignedId === null || rawAssignedId === undefined
      ? null
      : (Number.isFinite(Number(rawAssignedId)) ? Number(rawAssignedId) : null);

    const base: AdditionalWorkPdfRow = {
      name,
      detail,
      currency,
      price_str: fmtMoney(price),
      quantity,
      subtotal_ars: currency === 'ARS' ? totalInSourceCurrency : (usdRate > 0 ? totalInSourceCurrency * usdRate : 0),
      subtotal_usd: currency === 'USD' ? totalInSourceCurrency : (usdRate > 0 ? totalInSourceCurrency / usdRate : 0),
      material_name,
      assigned_material_id,
    };

    if (rowType !== 'frente') return base;

    const linearMeters = Number(row['linear_meters']) || 0;
    const m2AtSelection = Number(formulaValues?.['material_price_m2_at_selection']) || 0;
    const multiplier = Number(formulaValues?.['multiplier'] ?? formulaValues?.['constant']);

    return {
      ...base,
      type: 'frente',
      quantity: linearMeters,
      linear_meters_str: linearMeters > 0
        ? fmtMeasureUnit(linearMeters, 'ml')
        : null,
      linear_meters: linearMeters,
      multiplier: Number.isFinite(multiplier) ? multiplier : FRENTE_FORMULA_MULTIPLIER_DEFAULT,
      material_price_per_m2_str: m2AtSelection > 0 ? fmtMoney(m2AtSelection) : null,
      formula_constant_str: Number.isFinite(multiplier) ? fmtMoney(multiplier) : null,
    };
  });
}

/**
 * Bucket additional works into per-material and "common" (GLOBAL) groups.
 * An unassigned frente (no catalogue material id) is GLOBAL even when a
 * legacy `material_name` still carries a name, so it shows in every option.
 */
export function bucketAdditionalWorks(additional_works: AdditionalWorkPdfRow[]): AdditionalBuckets {
  const adtByMaterial: Record<string, AdditionalWorkPdfRow[]> = {};
  const adtCommon: AdditionalWorkPdfRow[] = [];
  for (const row of additional_works) {
    const key = row.material_name ?? POOL_MATERIAL_GLOBAL;
    const isAlt = typeof key === 'string' && key.startsWith('__ALT__:');
    const bucketKey = isAlt ? key.slice('__ALT__:'.length) : key;
    const isUnassignedFrente =
      row.type === 'frente' && (row.assigned_material_id == null || row.assigned_material_id === '');
    if (isUnassignedFrente || !bucketKey || bucketKey === POOL_MATERIAL_GLOBAL) {
      adtCommon.push(row);
    } else {
      if (!adtByMaterial[bucketKey]) adtByMaterial[bucketKey] = [];
      adtByMaterial[bucketKey].push(row);
    }
  }
  return { additionalByMaterial: adtByMaterial, additionalCommon: adtCommon };
}