import { describe, expect, it } from 'vitest';
import {
  FRENTE_FORMULA_MULTIPLIER_DEFAULT,
  FRENTE_LINEAR_COEFFICIENT,
  buildFrenteMaterialOptions,
  buildFrenteSelectionFor,
  computeFrenteTotal,
  resolveFrenteMultiplier,
} from '../utils/frentePricing';
import type { MaterialInForm } from '../types/budget';
import type { AdditionalWork } from '../types/additionalWork';

describe('computeFrenteTotal — multiplicative formula', () => {
  it('matches the corrected spec: USD 330/m² × 0.13 × 1.15 × 2.93 m', () => {
    const out = computeFrenteTotal(330, 1.15, 2.93);
    // 330 * 0.13 * 1.15 = 49.335 → rounded to 49.33 or 49.34 depending on
    // IEEE-754 quirks. Test with tolerance covering both.
    expect(Math.abs(out.price_per_meter - 49.34)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(out.total - 144.55)).toBeLessThanOrEqual(0.10);
  });

  it('matches the 1.5 ml case (decimal reported by the operator)', () => {
    const out = computeFrenteTotal(330, 1.15, 1.5);
    // 330 * 0.13 * 1.15 = 49.33; × 1.5 = 73.995 → 74.00
    expect(Math.abs(out.price_per_meter - 49.33)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(out.total - 74.00)).toBeLessThanOrEqual(0.05);
  });

  it('keeps the multiplier in the material currency (ARS case)', () => {
    // 200 × 0.13 × 1.15 = 29.90; × 1.5 = 44.85
    const out = computeFrenteTotal(200, 1.15, 1.5);
    expect(Math.abs(out.price_per_meter - 29.90)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(out.total - 44.85)).toBeLessThanOrEqual(0.05);
  });

  it('returns 0 for zero inputs without blowing up', () => {
    expect(computeFrenteTotal(0, 0, 0)).toEqual({ price_per_meter: 0, total: 0 });
    // 330 * 0.13 * 1.15 = 49.33 (or 49.34 — IEEE-754 stores 49.335 as
    // 49.33499… which rounds to 49.33). Tolerate either side.
    const out = computeFrenteTotal(330, 1.15, 0);
    expect(Math.abs(out.price_per_meter - 49.34)).toBeLessThanOrEqual(0.02);
    expect(out.total).toBe(0);
  });

  it('rounds to 2dp', () => {
    const out = computeFrenteTotal(99.9999, 1.123, 2.2222);
    expect(Number.isFinite(out.price_per_meter)).toBe(true);
    expect(Number.isFinite(out.total)).toBe(true);
    expect(round2(out.price_per_meter)).toBe(out.price_per_meter);
    expect(round2(out.total)).toBe(out.total);
  });

  it('honours a custom formula multiplier', () => {
    const out = computeFrenteTotal(330, 2.5, 2);
    expect(out.price_per_meter).toBe(round2(330 * 0.13 * 2.5));
    expect(out.total).toBe(round2(out.price_per_meter * 2));
  });
});

describe('resolveFrenteMultiplier', () => {
  it('falls back to the business default when null/missing', () => {
    expect(resolveFrenteMultiplier(null)).toBe(FRENTE_FORMULA_MULTIPLIER_DEFAULT);
    expect(resolveFrenteMultiplier(undefined)).toBe(FRENTE_FORMULA_MULTIPLIER_DEFAULT);
    const stub: Pick<AdditionalWork, 'formula_constant'> = { formula_constant: null };
    expect(resolveFrenteMultiplier(stub as AdditionalWork)).toBe(FRENTE_FORMULA_MULTIPLIER_DEFAULT);
  });

  it('uses the catalogue multiplier when present', () => {
    const stub: Pick<AdditionalWork, 'formula_constant'> = { formula_constant: 2.5 };
    expect(resolveFrenteMultiplier(stub as AdditionalWork)).toBe(2.5);
  });

  it('tolerates garbage values', () => {
    const stub: Pick<AdditionalWork, 'formula_constant'> = { formula_constant: Number.NaN as unknown as number };
    expect(resolveFrenteMultiplier(stub as AdditionalWork)).toBe(FRENTE_FORMULA_MULTIPLIER_DEFAULT);
  });
});

describe('buildFrenteMaterialOptions', () => {
  const materials: MaterialInForm[] = [
    {
      id: 42,
      name: 'Negro Brasil',
      price_m2: 200,
      price_m2_usd: 330,
      currency: 'USD',
      quantity: 1,
      m2_used: 1,
      m2_budgeted: 1,
      length: 100,
      width: 100,
      is_alternative: false,
    },
    {
      name: 'Gris Mara',
      price_m2: 50000,
      price_m2_usd: 0,
      currency: 'ARS',
      quantity: 1,
      m2_used: 1,
      m2_budgeted: 1,
      length: 100,
      width: 100,
      is_alternative: true,
    },
  ];

  it('flattens form materials into picker options', () => {
    const out = buildFrenteMaterialOptions({ materials });
    expect(out).toHaveLength(2);
    expect(out[0].name).toBe('Negro Brasil');
    expect(out[0].currency).toBe('USD');
    expect(out[0].price_per_m2).toBe(330);
    expect(out[0].is_alternative).toBe(false);
  });

  it('attaches the snapshot id when the form carries it', () => {
    const out = buildFrenteMaterialOptions({ materials });
    expect(out[0].id).toBe(42);
    expect(out[0].price_per_m2).toBe(330); // USD row uses price_m2_usd
  });

  it('falls back to catalogue lookup by name when the snapshot has no id', () => {
    const noId = materials.map((m) => ({ ...m, id: null as number | null }));
    const catalogue = [{ id: 7, name: 'Gris Mara', base_price: 50000, price_usd: 0, currency: 'ARS' }];
    const out = buildFrenteMaterialOptions({ materials: noId, catalogueMaterials: catalogue });
    expect(out[1].id).toBe(7);
  });

  it('returns an empty list when no materials supplied', () => {
    expect(buildFrenteMaterialOptions({ materials: [] })).toEqual([]);
    expect(buildFrenteMaterialOptions({ materials: null })).toEqual([]);
  });
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

describe('buildFrenteSelectionFor', () => {
  const catalogueRow = {
    id: 24,
    name: 'Frente / Regrueso',
    detail: 'Cálculo automático por fórmula',
    currency: 'USD' as const,
  };

  it('builds a USD row pre-assigned to the catalogue id', () => {
    const mat = {
      id: 131,
      name: 'Negro Brasil',
      price_per_m2: 330,
      currency: 'USD' as const,
      is_alternative: false,
    };
    const out = buildFrenteSelectionFor(catalogueRow, mat, 1.15);
    expect(out.additional_work_id).toBe(24);
    expect(out.assigned_material_id).toBe(131);
    expect(out.linear_meters).toBe(1);
    expect(out.type).toBe('frente');
    expect(out.materialName).toBe('Negro Brasil');
    expect(out.currency).toBe('USD');
    // 330 × 0.13 × 1.15 = 49.33 / 49.34 (IEEE-754); × 1ml = same.
    expect(Math.abs(out.total - 49.33)).toBeLessThanOrEqual(0.01);
  });

  it('tags the materialName for alternativas so downstream bucketing distinguishes them', () => {
    const mat = {
      id: 132,
      name: 'Marmol Carrara',
      price_per_m2: 410,
      currency: 'USD' as const,
      is_alternative: true,
    };
    const out = buildFrenteSelectionFor(catalogueRow, mat, 1.15);
    // alternativa rows get a sentinel prefix on materialName so per-option
    // bucketing in the Presupuesto card distinguishes them from principals.
    expect(out.materialName.startsWith('__ALT__:')).toBe(true);
    expect(out.materialName).toContain('Marmol Carrara');
  });

  it('keeps assigned_material_id = null when the material snapshot has no id (legacy budgets)', () => {
    const mat: {
      id: number | null;
      name: string;
      price_per_m2: number;
      currency: 'ARS' | 'USD';
      is_alternative: boolean;
    } = {
      id: null,
      name: 'Negro Brasil',
      price_per_m2: 330,
      currency: 'USD' as const,
      is_alternative: false,
    };
    const out = buildFrenteSelectionFor(catalogueRow, mat, 1.15);
    expect(out.assigned_material_id).toBeNull();
  });
});

describe('module constants', () => {
  it('exports the spec constants', () => {
    expect(FRENTE_LINEAR_COEFFICIENT).toBe(0.13);
    expect(FRENTE_FORMULA_MULTIPLIER_DEFAULT).toBe(1.15);
  });
});
