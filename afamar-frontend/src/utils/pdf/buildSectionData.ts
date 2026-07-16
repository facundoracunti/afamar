/**
 * Row builders and section bucketing for PDF data construction.
 */

import { POOL_MATERIAL_GLOBAL } from '../../types/budget';
import type {
  MaterialInForm,
  PoolInForm,
  PdfDataRow,
  MaterialPdfRow,
  PoolPdfRow,
  AdditionalWorkPdfRow,
  MaterialSection,
} from './pdfTypes';
import {
  M2_CONCEPTS,
  UNIT_CONCEPTS,
  LINEAR_CONCEPTS,
  fmtNum,
  fmtMoney,
  fmtUnit,
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
    const m2Value = isM2 ? Math.round(length * width * quantity * 10000) / 10000 : null;

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
      length_str: showLength && length ? fmtUnit(length, 2, 'm') : null,
      width_str: showWidth && width ? fmtUnit(width, 2, 'm') : null,
      m2_label: isUnit ? 'U' : isM2 ? fmtNum(m2Value) : null,
      quantity: Number.isInteger(quantity) ? quantity : quantity,
      currency,
      price_str: fmtMoney(price),
      labor_str: conceptCode === 'OTHER' && labor > 0 ? fmtMoney(labor) : null,
      subtotal_ars: subtotalArs,
      subtotal_usd: subtotalUsd,
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
      length_str: fmtUnit(length, 2, 'm'),
      width_str: fmtUnit(width, 2, 'm'),
      quantity: Number.isInteger(quantity) ? quantity : quantity,
      m2_str: fmtNum(m2),
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

export function asPools(raw: unknown): PoolInForm[] {
  return (parseJsonList(raw) as PoolInForm[]).filter(Boolean);
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
  const mainSubtotalArs =
    mainMaterialRows.reduce((s, r) => s + r.subtotal_ars, 0) +
    mainPoolRows.reduce((s, r) => s + r.subtotal_ars, 0) +
    mainFabrication.reduce((s, r) => s + r.subtotal_ars, 0) +
    mainAdditionArs;
  const mainSubtotalUsd =
    mainMaterialRows.reduce((s, r) => s + r.subtotal_usd, 0) +
    mainPoolRows.reduce((s, r) => s + r.subtotal_usd, 0) +
    mainFabrication.reduce((s, r) => s + r.subtotal_usd, 0) +
    mainAdditionUsd;
  const mainName = mainMaterials.length === 1 ? mainMaterials[0].name : '';

  // Alternatives
  const builtAlternatives: MaterialSection[] = [];
  alternatives.forEach((alt, idx) => {
    const altMaterialRows = buildMaterialRows([alt], usdRate);
    const altFabrication: PdfDataRow[] = [
      ...fabricationCommon,
      ...(fabricationByMaterial[alt.name] ?? []),
    ];
    const altPools: PoolPdfRow[] = [
      ...poolsCommon,
      ...(poolsByMaterial[alt.name] ?? []),
    ];
    const altAdditional: AdditionalWorkPdfRow[] = [
      ...addicionalBuckets.additionalCommon,
      ...(addicionalBuckets.additionalByMaterial[alt.name] ?? []),
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
      title: `ALTERNATIVA ${idx + 1}: ${alt.name}`,
      is_main: false,
      is_global: false,
      alternative_index: idx,
      material_name: alt.name,
      materials: altMaterialRows,
      pools: altPools,
      fabrication_details: altFabrication,
      additional_works: altAdditional,
      subtotal_ars: altSubtotalArs,
      subtotal_usd: altSubtotalUsd,
    });
  });

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
    sections.push(...builtAlternatives);
    for (const a of builtAlternatives) {
      flatMaterials.push(...a.materials);
      flatPools.push(...a.pools);
      flatFabrication.push(...a.fabrication_details);
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
