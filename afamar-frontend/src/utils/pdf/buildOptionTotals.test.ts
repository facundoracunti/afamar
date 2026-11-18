import { describe, expect, it } from 'vitest';
import { buildPdfData } from './buildPdfData';
import type { BudgetOption, BudgetPiece } from '../../types/budget';
import { INITIAL_FORM } from '../../hooks/entityFormConstants';

// ── Fixtures ─────────────────────────────────────────────────────────

function piece(name: string, material: string, priceM2: number, poolPrice = 0): BudgetPiece {
  return {
    id: `p-${name}`,
    name,
    mainMaterial: {
      id: 1,
      name: material,
      price_m2: priceM2,
      price_m2_usd: 0,
      currency: 'ARS',
      quantity: 1,
      m2_used: 0,
      m2_budgeted: 0,
      length: 2,
      width: 1,
      is_alternative: false,
    },
    alternativeMaterials: [],
    fabrication_details: [],
    additional_works_data: '[]',
    pools: poolPrice
      ? [{
          pool_id: 1, brand: 'JOHNSON', model: 'Q 76 A',
          price: poolPrice, currency: 'ARS', quantity: 1,
        }]
      : [],
  };
}

function option(id: string, name: string, isSelected: boolean, pieces: BudgetPiece[]): BudgetOption {
  return { id, name, is_selected: isSelected, pieces };
}

function formWithOptions(options: BudgetOption[]): Record<string, unknown> {
  const active = options.find((o) => o.is_selected) ?? options[0];
  return {
    ...INITIAL_FORM,
    options,
    active_option_id: active?.id ?? '',
    pieces: active?.pieces ?? [],
  } as unknown as Record<string, unknown>;
}

const baseParams = {
  document_type: 'budget' as const,
  company: {
    company_name: 'AFAMAR',
    company_tagline: '',
    company_address: '',
    company_phone: '',
    company_email: '',
    company_logo: '',
    pdf_footer: '',
  },
  globalTerms: { budget_terms: [], delivery_terms: [], warranty_text: [] },
  sketchImages: [],
};

// ── Tests ────────────────────────────────────────────────────────────

describe('buildOptionTotals — Resumen Comparativo de Opciones (B1)', () => {
  it('produces one priced row per option, each from its OWN pieces', () => {
    const opts = [
      option('opt-1', 'Opción 1', true, [
        piece('COCINA', 'CALACATTA', 100_000),
        piece('BAÑO', 'BLANCO', 50_000),
      ]),
      option('opt-2', 'Opción 2', false, [
        piece('COCINA', 'NEGRO BRASIL', 300_000),
      ]),
    ];
    const data = buildPdfData({
      ...baseParams,
      form: formWithOptions(opts),
      overrides: {},
    });

    const totals = data.option_totals!;
    expect(totals).toHaveLength(2);
    // Opción 1 = COCINA 200.000 + BAÑO 100.000 = 300.000
    expect(totals[0].subtotal_ars).toBe(300_000);
    expect(totals[0].piece_names).toEqual(['COCINA', 'BAÑO']);
    // Opción 2 = COCINA 600.000 (independent — no leakage)
    expect(totals[1].subtotal_ars).toBe(600_000);
    expect(totals[1].piece_names).toEqual(['COCINA']);
    expect(totals[1].is_selected).toBe(false);
    // Materials are listed so the summary shows WHAT is being priced.
    expect(totals[0].material_names).toEqual(['CALACATTA', 'BLANCO']);
    expect(totals[1].material_names).toEqual(['NEGRO BRASIL']);
  });

  it('includes the pileta in the option subtotal', () => {
    const opts = [
      option('opt-1', 'Opción 1', true, [piece('COCINA', 'CALACATTA', 100_000, 850_000)]),
      option('opt-2', 'Opción 2', false, [piece('COCINA', 'NEGRO', 300_000, 1_200_000)]),
    ];
    const data = buildPdfData({ ...baseParams, form: formWithOptions(opts), overrides: {} });
    // 200.000 material + 850.000 pileta
    expect(data.option_totals![0].subtotal_ars).toBe(1_050_000);
    expect(data.option_totals![1].subtotal_ars).toBe(1_800_000);
  });

  it('keeps the selected option USD total aligned with its structured pileta', () => {
    const base = piece('COCINA', 'CALACATTA', 1_000_000, 200_000);
    const usdPiece: BudgetPiece = {
      ...base,
      mainMaterial: {
        ...base.mainMaterial!,
        currency: 'USD',
        price_m2: 1_000_000,
        price_m2_usd: 1000,
      },
    };
    const opts = [
      option('opt-1', 'Opción 1', true, [usdPiece]),
      option('opt-2', 'Opción 2', false, [piece('COCINA', 'NEGRO', 300_000, 300_000)]),
    ];
    const data = buildPdfData({
      ...baseParams,
      form: { ...formWithOptions(opts), usd_rate: 1000 },
      overrides: {},
    });

    expect(data.total_usd).toBe(2200);
    const selected = data.option_totals!.find((total) => total.is_selected);
    expect(selected?.subtotal_usd).toBe(2200);
    expect(selected?.total_usd).toBe(2200);
  });

  it('is EMPTY for a legacy single-option budget (B1: zero PDF regression)', () => {
    // No `options` at all — the traditional Hoja de Alternativas must
    // stay in charge, so `option_totals` is not populated.
    const legacy = {
      ...INITIAL_FORM,
      pieces: [piece('COCINA', 'CALACATTA', 100_000)],
    } as unknown as Record<string, unknown>;
    const data = buildPdfData({ ...baseParams, form: legacy, overrides: {} });
    expect(data.option_totals).toBeUndefined();
  });

  it('is EMPTY for a budget with a single stored option', () => {
    const opts = [option('opt-1', 'Opción 1', true, [piece('COCINA', 'CALACATTA', 100_000)])];
    const data = buildPdfData({ ...baseParams, form: formWithOptions(opts), overrides: {} });
    expect(data.option_totals).toBeUndefined();
  });

  it('keeps the legacy alternative_totals alongside the option summary', () => {
    // Both blocks coexist: the option sheet drives page 2, while the
    // per-material alternative totals still feed the legacy components.
    const opts = [
      option('opt-1', 'Opción 1', true, [piece('COCINA', 'CALACATTA', 100_000)]),
      option('opt-2', 'Opción 2', false, [piece('COCINA', 'NEGRO', 300_000)]),
    ];
    const data = buildPdfData({ ...baseParams, form: formWithOptions(opts), overrides: {} });
    expect(data.option_totals).toHaveLength(2);
    // No material alternatives quoted → the legacy block stays empty.
    expect(data.alternative_totals ?? []).toEqual([]);
  });

  it('runs the document rule set (descuento comercial) over each option', () => {
    const opts = [
      option('opt-1', 'Opción 1', true, [piece('COCINA', 'CALACATTA', 100_000)]),
      option('opt-2', 'Opción 2', false, [piece('COCINA', 'NEGRO', 300_000)]),
    ];
    const data = buildPdfData({
      ...baseParams,
      form: {
        ...formWithOptions(opts),
        discount_enabled: true,
        discount_target: 'total',
        discount_percentage: 10,
      } as unknown as Record<string, unknown>,
      overrides: {},
    });
    // 10% off each option's own subtotal (200.000 → 180.000, 600.000 → 540.000).
    expect(data.option_totals![0].total_ars).toBe(180_000);
    expect(data.option_totals![1].total_ars).toBe(540_000);
  });

  it('uses the contractual commercial rounding for each option final total', () => {
    const opts = [
      option('opt-1', 'OpciÃ³n 1', true, [piece('COCINA', 'CALACATTA', 285_149.70)]),
      option('opt-2', 'OpciÃ³n 2', false, [piece('COCINA', 'CHACARERA', 285_149.70)]),
    ];
    const data = buildPdfData({
      ...baseParams,
      form: {
        ...formWithOptions(opts),
        usd_rate: 1575,
      },
      overrides: {},
    });

    const totals = data.option_totals!;
    expect(totals[0].subtotal_ars).toBe(570_299.40);
    expect(totals[0].display_subtotal_ars).toBe(575_000);
    expect(totals[0].display_discount_fixed_amount).toBe(0);
    expect(totals[0].total_ars).toBe(575_000);
    expect(totals[0].total_usd).toBe(365.08);
    expect(totals[0].balance_due).toBe(575_000);
  });

  it('shows a rounded subtotal and a commercial discount that closes to the final total', () => {
    const opts = [
      option('opt-1', 'OpciÃ³n 1', true, [piece('COCINA', 'GRIS MARA', 266_822)]),
      option('opt-2', 'OpciÃ³n 2', false, [piece('COCINA', 'CHACARERA', 300_000)]),
    ];
    const data = buildPdfData({
      ...baseParams,
      form: {
        ...formWithOptions(opts),
        usd_rate: 1575,
        discount_fixed_amount: 60_835.42,
      },
      overrides: {},
    });

    const selected = data.option_totals!.find((total) => total.is_selected)!;
    expect(selected.subtotal_ars).toBe(533_644);
    expect(selected.display_subtotal_ars).toBe(535_000);
    expect(selected.display_discount_fixed_amount).toBe(60_000);
    expect(selected.total_ars).toBe(475_000);
  });
});
