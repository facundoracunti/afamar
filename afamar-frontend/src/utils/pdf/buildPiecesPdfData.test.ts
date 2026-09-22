import { describe, expect, it } from 'vitest';
import { buildPieces, piecesSubtotal } from './buildPiecesPdfData';
import { buildPdfData, buildAlternativeTotals } from './buildPdfData';
import { flattenPieces } from '@features/budgets/utils/pieces';
import type { BudgetPiece, MaterialInForm, PoolInForm } from '../../types/budget';

function mat(extra: Partial<MaterialInForm> & Pick<MaterialInForm, 'name'>): MaterialInForm {
  return {
    id: null,
    category: '',
    color: '',
    price_m2: 0,
    price_m2_usd: 0,
    currency: 'ARS',
    quantity: 1,
    m2_used: 0,
    m2_budgeted: 0,
    length: 1,
    width: 1,
    is_alternative: false,
    ...extra,
  };
}

const materialA = mat({
  name: 'Blanco',
  currency: 'USD',
  price_m2_usd: 300,
  is_alternative: false,
});
const materialB = mat({
  name: 'Marmol',
  currency: 'USD',
  price_m2_usd: 400,
  is_alternative: true,
});
const materialC = mat({
  name: 'Negro',
  price_m2: 100000,
  length: 2,
  width: 1,
  is_alternative: false,
});

const piece1Pool: PoolInForm = {
  pool_id: 1,
  brand: 'JOHNSON',
  model: 'SIGNATURE ENKEL',
  price: 936000,
  currency: 'ARS',
  quantity: 1,
  material: '',
};
const piece2Pool: PoolInForm = {
  pool_id: 2,
  brand: 'JOHNSON',
  model: 'OV 370 L',
  price: 612000,
  currency: 'ARS',
  quantity: 1,
  material: '',
};

const piece1: BudgetPiece = {
  id: 'p1',
  name: 'Mesada 1',
  mainMaterial: materialA,
  alternativeMaterials: [materialB],
  fabrication_details: [
    {
      concept: 'BASEBOARD',
      detail: '',
      material: '',
      length: 0.5,
      width: 0.1,
      m2: 0.05,
      labor: null,
      currency: 'ARS',
      quantity: 1,
      price: 20000,
    },
  ],
  additional_works_data: JSON.stringify([
    {
      name: 'Traforo',
      detail: '',
      currency: 'ARS',
      price: 50000,
      quantity: 1,
      total: 50000,
      type: 'flat',
      materialName: '',
    },
  ]),
  pools: [piece1Pool],
};

const piece2: BudgetPiece = {
  id: 'p2',
  name: 'Mesada 2',
  mainMaterial: materialC,
  alternativeMaterials: [],
  fabrication_details: [],
  additional_works_data: '[]',
  pools: [piece2Pool],
};

const company = {
  company_name: 'AFAMAR',
  company_tagline: '',
  company_address: '',
  company_phone: '',
  company_email: '',
  company_logo: '',
  pdf_footer: '',
};
const globalTerms = { budget_terms: [], delivery_terms: [], warranty_text: [] };

function makeForm(pieces: BudgetPiece[], extra: Record<string, unknown> = {}) {
  const flat = flattenPieces(pieces);
  return {
    number: 'P-TEST-PIECES',
    status: 'PENDING',
    usd_rate: 1000,
    materials_data: flat.materials_data,
    fabrication_details: flat.fabrication_details,
    additional_works_data: flat.additional_works_data,
    pools_data: flat.pools_data,
    pieces,
    ...extra,
  } as unknown as Record<string, unknown>;
}

describe('buildPieces', () => {
  it('returns no pieces for a legacy budget (empty / missing pieces_data)', () => {
    expect(buildPieces({ pieces: [] }, 1000)).toEqual([]);
    expect(buildPieces({}, 1000)).toEqual([]);
  });

  it('splits the flattened arrays back into one block per piece', () => {
    const pieces = buildPieces(makeForm([piece1, piece2]), 1000);

    expect(pieces).toHaveLength(2);
    expect(pieces[0].name).toBe('Mesada 1');
    expect(pieces[1].name).toBe('Mesada 2');

    // Piece 1 = material A (300 USD → 300.000 ARS) + zócalo (20.000 / 20) +
    // traforo (50.000 / 50) + its own pileta (936.000 / 936)
    expect(pieces[0].subtotal_ars).toBe(1306000);
    expect(pieces[0].subtotal_usd).toBe(1306);
    // Piece 2 = material C (2 m² × 100.000 ARS) + its own pileta (612.000 / 612)
    expect(pieces[1].subtotal_ars).toBe(812000);
    expect(pieces[1].subtotal_usd).toBe(812);
  });

  it('groups each piece alternatives and swaps only that piece material', () => {
    const pieces = buildPieces(makeForm([piece1, piece2]), 1000);

    expect(pieces[0].alternatives).toHaveLength(1);
    const alt = pieces[0].alternatives[0];
    expect(alt.material_name).toBe('Marmol');
    // Alt = material B (400 USD → 400.000 ARS) + piece's own zócalo (20.000,
    // raw — not revalued because subtotal_ars ≠ 0) + traforo (50.000) +
    // piece's pileta (936.000, inherited raw). = 1.406.000 ARS.
    expect(alt.subtotal_ars).toBe(1406000);
    expect(alt.subtotal_usd).toBe(1406);
    // Piece 2 has no alternatives.
    expect(pieces[1].alternatives).toHaveLength(0);
  });

  it('inherits the piece piletas into every alternative', () => {
    const pieces = buildPieces(makeForm([piece1, piece2]), 1000);
    const alt = pieces[0].alternatives[0];
    // The alternative carries the SAME pileta as the piece principal.
    expect(alt.pools).toHaveLength(1);
    expect(alt.pools[0].brand).toBe('JOHNSON');
    expect(alt.pools[0].model).toBe('SIGNATURE ENKEL');
  });

  it('collapses several panes of the same alternative material into one option', () => {
    const panes: BudgetPiece = {
      id: 'p3',
      name: 'Mesada 3',
      mainMaterial: null,
      alternativeMaterials: [
        mat({ name: 'Posta', currency: 'USD', price_m2_usd: 200, is_alternative: true }),
        mat({ name: 'Posta', currency: 'USD', price_m2_usd: 200, is_alternative: true, length: 2 }),
      ],
      fabrication_details: [],
      additional_works_data: '[]',
      pools: [],
    };
    const pieces = buildPieces(makeForm([panes]), 1000);
    expect(pieces[0].alternatives).toHaveLength(1);
    // 1 m² + 2 m² = 3 m² × 200 USD
    expect(pieces[0].alternatives[0].subtotal_usd).toBe(600);
  });

  it('sums the principal material AND its mainMaterialRows tramos into the piece', () => {
    const tramo = mat({
      name: 'Negro',
      price_m2: 100000,
      length: 3,
      width: 1,
      is_alternative: false,
    });
    const multiTramo: BudgetPiece = {
      id: 'p-tramos',
      name: 'Mesada con tramos',
      mainMaterial: materialC, // 2 m² × 100.000 ARS
      mainMaterialRows: [tramo], // 3 m² × 100.000 ARS
      alternativeMaterials: [],
      fabrication_details: [],
      additional_works_data: '[]',
      pools: [],
    };
    const pieces = buildPieces(makeForm([multiTramo]), 1000);

    expect(pieces).toHaveLength(1);
    // Both rows render as separate material lines (+2 m² and +3 m²).
    expect(pieces[0].materials).toHaveLength(2);
    const matt = pieces[0].materials.map((m) => m.subtotal_ars);
    expect(matt[0]).toBe(200000);
    expect(matt[1]).toBe(300000);
    // 5 m² total → subtotal = 5 × 100.000 ARS = 500.000.
    expect(pieces[0].subtotal_ars).toBe(500000);
    expect(pieces[0].subtotal_usd).toBe(500);
  });

  it('sum of piece principals equals the document subtotal (pools included per piece)', () => {
    const pieces = buildPieces(makeForm([piece1, piece2]), 1000);
    const sum = piecesSubtotal(pieces);
    // Pools moved into pieces v2 — no document-global pool to add anymore.
    expect(sum.ars).toBe(1306000 + 812000);
    expect(sum.usd).toBe(1306 + 812);
  });
});

describe('buildAlternativeTotals', () => {
  const altParams = {
    transport: 0,
    transportUsd: 0,
    discountPct: 0,
    discountFixedRaw: 0,
    usdRate: 1000,
    pm: null,
    installments: 1,
    deposit: 0,
  };

  it('consolidates the same alternative material across pieces into ONE block', () => {
    // Second piece also quotes MARMOL as an alternative (same material),
    // with its own additional works + pileta.
    const piece2WithMarmol: BudgetPiece = {
      ...piece2,
      alternativeMaterials: [materialB],
      additional_works_data: JSON.stringify([
        {
          name: 'Traforo 2',
          detail: '',
          currency: 'USD',
          price: 30,
          quantity: 1,
          total: 30,
          type: 'flat',
          materialName: '',
        },
      ]),
    };
    const pieces = buildPieces(makeForm([piece1, piece2WithMarmol]), 1000);

    const totals = buildAlternativeTotals(pieces, altParams);
    // One consolidated block per material, not one per piece.
    expect(totals).toHaveLength(1);
    expect(totals[0].material_name).toBe('Marmol');

    // Piece 1 alt = material B (400.000) + zócalo (20.000) + traforo
    // (50.000) + pileta (936.000) = 1.406.000. Piece 2 alt = material B
    // (400.000) + traforo USD 30 (30.000) + pileta (612.000) = 1.042.000.
    expect(totals[0].subtotal_ars).toBe(1406000 + 1042000);
    expect(totals[0].subtotal_usd).toBe(1406 + 1042);
    // Both pieces are listed so the operator knows the scope.
    expect(totals[0].pieces).toEqual(['Mesada 1', 'Mesada 2']);
  });

  it('keeps different alternative materials in separate blocks', () => {
    const extraAlt = mat({
      name: 'Negro Absoluto',
      currency: 'ARS',
      price_m2: 150000,
      is_alternative: true,
    });
    const piece1TwoAlts: BudgetPiece = {
      ...piece1,
      alternativeMaterials: [materialB, extraAlt],
    };
    const pieces = buildPieces(makeForm([piece1TwoAlts]), 1000);
    const totals = buildAlternativeTotals(pieces, altParams);
    expect(totals.map((t) => t.material_name)).toEqual(['Marmol', 'Negro Absoluto']);
  });

  it('applies the document total rule set (discount + deposit) to the consolidated subtotal', () => {
    const pieces = buildPieces(makeForm([piece1]), 1000);
    // 10% commercial discount over the whole doc base + $500.000 seña.
    const totals = buildAlternativeTotals(pieces, {
      ...altParams,
      discountPct: 10,
      discountEnabled: true,
      deposit: 500000,
    });
    expect(totals).toHaveLength(1);
    expect(totals[0].subtotal_ars).toBe(1406000);
    // discount = 10% over subtotal (transport 0) = 140.600
    expect(totals[0].discount_fixed_amount).toBe(140600);
    // total = 1.406.000 - 140.600 = 1.265.400
    expect(totals[0].total_ars).toBe(1265400);
    // saldo = 1.265.400 - 500.000 = 765.400
    expect(totals[0].balance_due).toBe(765400);
    // USD side: 1406 - 140.6 = 1265.4
    expect(totals[0].total_usd).toBe(1265.4);
  });

  it('returns an empty list for pieces without alternatives', () => {
    const pieces = buildPieces(makeForm([piece2]), 1000);
    expect(buildAlternativeTotals(pieces, altParams)).toEqual([]);
  });
});

describe('buildPdfData — pieces branch', () => {
  it('attaches the pieces layout to a budget and keeps the document subtotal consistent', () => {
    const data = buildPdfData({
      form: makeForm([piece1, piece2]),
      document_type: 'budget',
      company,
      globalTerms,
    });

    expect(data.pieces).toBeDefined();
    expect(data.pieces).toHaveLength(2);
    expect(data.pieces?.[0].alternatives).toHaveLength(1);

    // Document subtotal = Σ piece principals (pools are already inside each
    // piece since v2 — no document-global pool to add).
    const piecesSum = piecesSubtotal(data.pieces || []).ars;
    expect(data.subtotal).toBe(piecesSum);
  });

  it('does not attach the pieces layout to a work order', () => {
    const data = buildPdfData({
      form: makeForm([piece1, piece2]),
      document_type: 'work_order',
      company,
      globalTerms,
    });
    expect(data.pieces).toBeUndefined();
    expect(data.alternative_totals).toBeUndefined();
  });

  it('attaches the consolidated alternative totals to a multi-piece budget', () => {
    const data = buildPdfData({
      form: makeForm([piece1, piece2]),
      document_type: 'budget',
      company,
      globalTerms,
    });

    expect(data.pieces).toBeDefined();
    // Only piece1 quotes an alternative — one consolidated block.
    expect(data.alternative_totals).toEqual([
      expect.objectContaining({
        material_name: 'Marmol',
        pieces: ['Mesada 1'],
        subtotal_ars: 1406000,
        subtotal_usd: 1406,
        total_ars: 1406000,
        total_usd: 1406,
        balance_due: 1406000,
      }),
    ]);
  });

  it('leaves a legacy budget without a pieces array', () => {
    const flat = flattenPieces([piece1, piece2]);
    // Legacy form: flattened arrays only, no `pieces`.
    const legacyForm = {
      number: 'P-LEGACY',
      status: 'PENDING',
      usd_rate: 1000,
      materials_data: flat.materials_data,
      fabrication_details: flat.fabrication_details,
      additional_works_data: flat.additional_works_data,
      pools_data: [],
    } as unknown as Record<string, unknown>;

    const data = buildPdfData({
      form: legacyForm,
      document_type: 'budget',
      company,
      globalTerms,
    });
    expect(data.pieces).toBeUndefined();
    expect(data.sections.length).toBeGreaterThan(0);
  });

  it('merges document-level fabrication_details (Porcelain Calculator) into every piece block', () => {
    // The Calculator de Porcelanato writes zócalos to `form.fabrication_details`
    // (it has no piece context), while pieces v3 stores fabrication per-piece.
    // The builder must merge the document-level column into every piece's
    // fabrication rows so the calculator's items render in each piece's
    // PDF breakdown (matches the legacy "common fabrication folds into
    // every option" semantic).
    const zocalo7 = {
      concept: 'BASEBOARD',
      detail: 'Zócalo de 7cm',
      material: '',
      material_price_m2: 0,
      length: 2.1,
      width: 0.07,
      m2: 0.147,
      labor: null,
      currency: 'ARS' as const,
      quantity: 1,
      price: 0,
    };
    const zocalo10 = {
      concept: 'BASEBOARD',
      detail: 'Zócalo de 10cm',
      material: '',
      material_price_m2: 0,
      length: 2.1,
      width: 0.1,
      m2: 0.21,
      labor: null,
      currency: 'ARS' as const,
      quantity: 1,
      price: 0,
    };
    const formWithCalculator = {
      ...makeForm([piece1]),
      fabrication_details: [zocalo7, zocalo10],
    } as unknown as Record<string, unknown>;

    const pieces = buildPieces(formWithCalculator, 1000);
    // Every piece block renders the calculator zócalos alongside its own.
    expect(pieces.length).toBeGreaterThan(0);
    for (const p of pieces) {
      const zocaloLabels = p.fabrication_details.map((r) => r.detail);
      expect(zocaloLabels).toContain('Zócalo de 7cm');
      expect(zocaloLabels).toContain('Zócalo de 10cm');
    }
  });
});
