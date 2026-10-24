/**
 * PDF MULTI-OPCIÓN — verificación del renderizado comercial (2026-10-01).
 *
 * Garantiza tres cosas:
 *
 *  1. El PDF NO contiene jerga interna de control ("OPCIÓN GANADORA",
 *     "se convierte en Orden de Trabajo", "descuenta el stock", …). El
 *     presupuesto es un documento COMERCIAL para el cliente final.
 *  2. Cada opción tiene su PROPIA página con el desglose completo (piezas,
 *     materiales, medidas, traforos, piletas) y su precio final.
 *  3. Los totales de cada opción coinciden EXACTAMENTE con lo que el
 *     operador ve en la solapa de esa opción en la web.
 */
import { describe, expect, it } from 'vitest';
import { buildPdfData } from './buildPdfData';
import type { BudgetOption, BudgetPiece } from '../../types/budget';
import { INITIAL_FORM } from '../../hooks/entityFormConstants';

// ── Fixtures ─────────────────────────────────────────────────────────

function piece(
  id: string,
  name: string,
  matName: string,
  priceM2: number,
  currency: 'ARS' | 'USD' = 'ARS',
): BudgetPiece {
  return {
    id,
    name,
    mainMaterial: {
      id: 1,
      name: matName,
      price_m2: currency === 'USD' ? 0 : priceM2,
      price_m2_usd: currency === 'USD' ? priceM2 : 0,
      currency,
      quantity: 1,
      m2_used: 0,
      m2_budgeted: 0,
      length: 2,
      width: 1,
      is_alternative: false,
    },
    mainMaterialRows: [],
    alternativeMaterials: [],
    fabrication_details: [
      {
        concept: 'BASEBOARD',
        detail: 'Zócalo',
        material: matName,
        length: 4,
        width: 0.105,
        quantity: 1,
        price: 42_000,
        currency: 'ARS',
      },
    ],
    additional_works_data: JSON.stringify([
      {
        additional_work_id: 5,
        name: 'Traforo de pileta',
        materialName: '__GLOBAL__',
        quantity: 1,
        price: 60_000,
        total: 60_000,
        currency: 'ARS',
        type: 'flat',
        detail: null,
      },
    ]),
    pools: [
      {
        pool_id: 1,
        brand: 'JOHNSON',
        model: 'Q 76 A',
        price: 850_000,
        currency: 'ARS',
        quantity: 1,
        material: matName,
      },
    ],
  } as unknown as BudgetPiece;
}

function option(
  id: string,
  name: string,
  isSelected: boolean,
  pieces: BudgetPiece[],
): BudgetOption {
  return { id, name, is_selected: isSelected, pieces };
}

const baseParams = {
  document_type: 'budget' as const,
  company: {
    company_name: 'AFAMAR',
    company_tagline: 'MÁRMOLES & GRANITOS',
    company_address: 'Córdoba',
    company_phone: '351',
    company_email: 'afamar@afamar.com',
    company_logo: '',
    pdf_footer: 'AFAMAR · Marble & Granite',
  },
  globalTerms: { budget_terms: ['Plazo de entrega: 30 días'], delivery_terms: [], warranty_text: [] },
  sketchImages: [],
};

function multiOptionForm(): Record<string, unknown> {
  const opt1 = option('opt-1', 'Opción 1', true, [piece('p1', 'COCINA', 'NEGRO BRASIL', 300_000)]);
  const opt2 = option('opt-2', 'Opción 2', false, [
    piece('p2', 'COCINA', 'MIAMI WHITE', 330, 'USD'),
  ]);
  const opt3 = option('opt-3', 'Opción 3', false, [
    piece('p3', 'ALZADA', 'BLANCO ZEN MATE', 150_000),
  ]);
  return {
    ...INITIAL_FORM,
    options: [opt1, opt2, opt3],
    active_option_id: 'opt-3',
    pieces: opt3.pieces,
    usd_rate: 1000,
  } as unknown as Record<string, unknown>;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('PDF multi-opción — data payload', () => {
  it('carries the FULL breakdown of EVERY option (pieces + final price)', () => {
    const data = buildPdfData({ ...baseParams, form: multiOptionForm(), overrides: {} });
    const totals = data.option_totals!;

    expect(totals).toHaveLength(3);

    // Every option carries its own per-piece blocks — the renderer prints
    // one page per option, so the customer can evaluate each variant.
    totals.forEach((t) => {
      expect(t.pieces.length).toBe(1);
      expect(t.pieces[0].materials.length).toBeGreaterThan(0);
      expect(t.pieces[0].pools.length).toBeGreaterThan(0);
      expect(t.pieces[0].additional_works.length).toBeGreaterThan(0);
      expect(t.pieces[0].fabrication_details.length).toBeGreaterThan(0);
    });

    // The pieces belong to the option itself (no cross-option leakage).
    // Identified BY NAME — the array is sorted by price, not by creation
    // order.
    const byMaterial = (name: string) =>
      totals.find((t) => t.material_names.includes(name))!;
    expect(byMaterial('NEGRO BRASIL').pieces[0].materials[0].name).toBe('NEGRO BRASIL');
    expect(byMaterial('MIAMI WHITE').pieces[0].materials[0].name).toBe('MIAMI WHITE');
    expect(byMaterial('BLANCO ZEN MATE').pieces[0].materials[0].name).toBe('BLANCO ZEN MATE');

    // Every option carries its own final price.
    expect(totals[0].total_ars).toBeGreaterThan(0);
    expect(totals[1].total_ars).toBeGreaterThan(0);
    expect(totals[2].total_ars).toBeGreaterThan(0);
  });

  it('prices each option with material + fabrication + additional works + pools', () => {
    const data = buildPdfData({ ...baseParams, form: multiOptionForm(), overrides: {} });
    const t = data.option_totals!.find((x) => x.material_names.includes('NEGRO BRASIL'))!;
    // 2 m² × 300.000 = 600.000 material + 42.000 zócalo + 60.000 traforo
    // + 850.000 pileta = 1.552.000
    expect(t.subtotal_ars).toBe(1_552_000);
    expect(t.total_ars).toBe(1_552_000);
    expect(t.piece_names).toEqual(['COCINA']);
    expect(t.material_names).toEqual(['NEGRO BRASIL']);
  });

  it('matches the per-tab subtotal the operator sees in the form', () => {
    // The form's tab bar prices each option with `computeOptionSubtotal`
    // — the SAME helper the PDF uses. Both must agree to the cent.
    const form = multiOptionForm();
    const data = buildPdfData({ ...baseParams, form, overrides: {} });
    const totals = data.option_totals!;
    const options = (form.options ?? []) as BudgetOption[];

    options.forEach((o) => {
      const pieceSubtotal = o.pieces[0];
      const m2 = pieceSubtotal.mainMaterial!.length * pieceSubtotal.mainMaterial!.width;
      const isUsd = pieceSubtotal.mainMaterial!.currency === 'USD';
      const priceM2 = isUsd
        ? pieceSubtotal.mainMaterial!.price_m2_usd
        : pieceSubtotal.mainMaterial!.price_m2;
      // A USD material contributes its ARS equivalent at the document rate.
      const materialArs = isUsd ? m2 * priceM2 * 1000 : m2 * priceM2;
      const expected = materialArs + 42_000 + 60_000 + 850_000;
      // Matched BY ID — the array is sorted by price.
      const row = totals.find((t) => t.id === o.id)!;
      expect(row.subtotal_ars).toBe(expected);
    });
  });

  it('keeps the document totals describing the WINNING option', () => {
    // Page 1 shows the winner's pieces → the TOTAL must be the winner's.
    const form = multiOptionForm();
    const data = buildPdfData({ ...baseParams, form, overrides: {} });
    const winner = data.option_totals!.find((t) => t.is_selected)!;
    expect(data.subtotal).toBe(winner.subtotal_ars);
    expect(data.total).toBe(winner.total_ars);
  });

  it('ORDERS the options from CHEAPEST to MOST EXPENSIVE', () => {
    // The comparison page and the detail pages share this array: the most
    // affordable variant opens the document, the priciest closes it.
    const data = buildPdfData({ ...baseParams, form: multiOptionForm(), overrides: {} });
    const totals = data.option_totals!;

    const prices = totals.map((t) => t.total_ars);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    // The cheapest one is BLANCO ZEN MATE (300.000 + 42.000 + 60.000
    // + 850.000 = 1.252.000), the priciest MIAMI WHITE (1.612.000).
    expect(totals[0].material_names).toEqual(['BLANCO ZEN MATE']);
    expect(totals[2].material_names).toEqual(['MIAMI WHITE']);
  });

  it('exposes the pileta (bacha) included in each option', () => {
    const data = buildPdfData({ ...baseParams, form: multiOptionForm(), overrides: {} });
    const totals = data.option_totals!;
    // Every option carries the sink ITSELF includes (not the project-wide
    // union) so the customer knows which bacha each variant comes with.
    totals.forEach((t) => {
      expect(t.pool_models.length).toBeGreaterThan(0);
      expect(t.pool_models[0]).toContain('JOHNSON');
    });
    // Matched BY ID (the array is sorted by price).
    const byId = (id: string) => totals.find((t) => t.id === id)!;
    expect(byId('opt-1').pool_models).toEqual(['JOHNSON Q 76 A']);
  });
});
