/**
 * Tests for the QUOTE OPTIONS GRID card builders.
 *
 * The core guarantee: the alternative cards in the budget form must show the
 * same "Subtotal Opción" the PDF draws. They derive their values from the
 * SAME orchestration as the PDF (`buildAlternativeSections` → `MaterialSection`),
 * so a sole-alternatives budget revalues the global zócalo/frente per option
 * and the card totals mirror the rendered PDF number-for-number.
 *
 * Fixture mirrors P-000004: ZIRCONIUM (USD) + GRIS MARA (ARS), a GLOBAL
 * zócalo, a GLOBAL frente and two flat traforos, at usd_rate 1535.
 */
import { describe, expect, it } from 'vitest';
import type { MaterialInForm, PoolInForm } from '../types/budget';
import {
  buildOptionFromMaterial,
  buildDetailFromSection,
  type AlternativaLike,
} from './budgetOptions';
import { buildAlternativeSections } from './pdf/buildPdfData';

const USD_RATE = 1535;

function budget4Form() {
  const materials_data: MaterialInForm[] = [
    { id: 27, name: 'ZIRCONIUM', price_m2: 750000, price_m2_usd: 750, currency: 'USD', quantity: 1, m2_used: 0, m2_budgeted: 0, length: 2.1, width: 0.6, is_alternative: true },
    { id: 27, name: 'ZIRCONIUM', price_m2: 750000, price_m2_usd: 750, currency: 'USD', quantity: 1, m2_used: 0, m2_budgeted: 0, length: 1.54, width: 0.55, is_alternative: true },
    { id: 1, name: 'GRIS MARA', price_m2: 180000, price_m2_usd: 180, currency: 'ARS', quantity: 1, m2_used: 0, m2_budgeted: 0, length: 2.1, width: 0.6, is_alternative: true },
    { id: 1, name: 'GRIS MARA', price_m2: 180000, price_m2_usd: 180, currency: 'ARS', quantity: 1, m2_used: 0, m2_budgeted: 0, length: 1.54, width: 0.55, is_alternative: true },
  ] satisfies MaterialInForm[];

  const fabrication_details = JSON.stringify([
    { concept: 'BASEBOARD', detail: '', material: '', material_price_m2: 0, length: 3.3, width: 0.1, m2: 0.33, quantity: 1, currency: 'ARS', price: 0 },
  ]);

  const pools_data: PoolInForm[] = [
    { pool_id: 25, brand: 'JOHNSON', model: 'SIGNATURE AXIS 55 B', price: 936000, currency: 'ARS', quantity: 1, material: '__GLOBAL__' },
  ];

  const additional_works_data = JSON.stringify([
    { additional_work_id: 1, name: 'Traforo de Pileta', detail: 'Apertura y pegado de pileta', price: 60000, currency: 'ARS', quantity: 1, total: 60000, materialName: '__GLOBAL__', type: 'flat' },
    { additional_work_id: 6, name: 'Frente Ingletetado 45', detail: 'Frente 45', price: 0, currency: 'USD', quantity: 1, total: 0, materialName: 'ZIRCONIUM', type: 'frente', linear_meters: 3.3, assigned_material_id: null, formula_values: null },
    { additional_work_id: 2, name: 'Traforo de Anafe', detail: 'Apertura de anafe', price: 70000, currency: 'ARS', quantity: 1, total: 70000, materialName: '__GLOBAL__', type: 'flat' },
  ]);

  return { materials_data, fabrication_details, pools_data, additional_works_data, usd_rate: USD_RATE };
}

describe('buildAlternativeSections — P-000004 card subtotals', () => {
  it('matches the PDF "Subtotal Opción" for every alternative (ARS + USD)', () => {
    const form = budget4Form();
    const { sections } = buildAlternativeSections(form as unknown as Record<string, unknown>);
    const altSections = sections.filter((s) => !s.is_main && !s.is_global);
    expect(altSections).toHaveLength(2);

    const sard = altSections.find((s) => s.material_name === 'ZIRCONIUM')!;
    const mara = altSections.find((s) => s.material_name === 'GRIS MARA')!;

    // PDF "Subtotal Opción": ZIRCONIUM $4.439.561,60 (USD 2.892,22)
    expect(sard.subtotal_ars).toBeCloseTo(4439561.6, 1);
    expect(sard.subtotal_usd).toBeCloseTo(2892.22, 1);
    // GRIS MARA $1.593.463,00 (USD 1.038,09)
    expect(mara.subtotal_ars).toBeCloseTo(1593463.0, 1);
    expect(mara.subtotal_usd).toBeCloseTo(1038.09, 1);
  });

  it('builds the per-option detail lines (zócalo + pileta + traforos + frente)', () => {
    const form = budget4Form();
    const { sections } = buildAlternativeSections(form as unknown as Record<string, unknown>);
    const sard = sections.find((s) => s.material_name === 'ZIRCONIUM')!;

    const detail = buildDetailFromSection(sard);
    const concepts = detail.map((d) => d.concept);

    expect(concepts).toContain('Zócalo');
    expect(concepts).toContain('Pileta JOHNSON SIGNATURE AXIS 55 B');
    expect(concepts).toContain('Traforo de Pileta');
    expect(concepts).toContain('Traforo de Anafe');
    expect(concepts).toContain('Frente Ingletetado 45');
    // Zócalo revalued for ZIRCONIUM (USD 247.50), frente USD 370.01.
    const zocalo = detail.find((d) => d.concept === 'Zócalo')!;
    expect(zocalo.currency).toBe('USD');
    expect(zocalo.total).toBeCloseTo(247.5, 1);
  });
});

describe('buildOptionFromMaterial — card carries the PDF-driven subtotal', () => {
  it('propagates subtotalARS/subtotalUSD/detail onto the card and totals it', () => {
    const form = budget4Form();
    const { sections } = buildAlternativeSections(form as unknown as Record<string, unknown>);
    const sardSection = sections.find((s) => s.material_name === 'ZIRCONIUM')!;

    const mat = form.materials_data.find((m) => m.name === 'ZIRCONIUM')!;
    const card: AlternativaLike = buildOptionFromMaterial(mat, {
      usdRate: USD_RATE,
      sumatoriaMaterialesPrincipalARS: 0,
      sumatoriaAdicionalesARS: 0,
      subtotalARS: Math.round(sardSection.subtotal_ars * 100) / 100,
      subtotalUSD: Math.round(sardSection.subtotal_usd * 100) / 100,
      detail: buildDetailFromSection(sardSection),
    });

    // The card's TOTAL (what SUBTOTALES/TOTAL/SALDO render) equals the PDF.
    expect(card.totalFinalARS).toBeCloseTo(4439561.6, 1);
    expect(card.subtotalARS).toBeCloseTo(4439561.6, 1);
    expect(card.subtotalUSD).toBeCloseTo(2892.22, 1);
    expect(card.detail).toBeDefined();
    expect(card.detail!.length).toBeGreaterThan(0);
    // Material base is the representative (first) pane's material-only cost,
    // rendered separately from the per-option subtotal.
    expect(card.costoMaterialBase).toBeCloseTo(945, 2);
  });

  it('falls back to the legacy total when no per-option subtotal is provided', () => {
    const mat: MaterialInForm = {
      id: 1, name: 'GRIS MARA', price_m2: 180000, price_m2_usd: 180, currency: 'ARS',
      quantity: 1, m2_used: 0, m2_budgeted: 0, length: 2, width: 1, is_alternative: true,
    };
    const card = buildOptionFromMaterial(mat, {
      usdRate: USD_RATE,
      sumatoriaMaterialesPrincipalARS: 0,
      sumatoriaAdicionalesARS: 500000,
    });
    // legacy: material (2×1×180000 = 360000) + adicionales 500000
    expect(card.totalFinalARS).toBe(860000);
    expect(card.detail).toBeUndefined();
  });
});
