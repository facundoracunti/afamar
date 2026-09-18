import { describe, expect, it } from 'vitest';
import { buildPieces, piecesSubtotal } from './buildPiecesPdfData';
import { buildPdfData } from './buildPdfData';
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

  it('sum of piece principals equals the document subtotal (pools included per piece)', () => {
    const pieces = buildPieces(makeForm([piece1, piece2]), 1000);
    const sum = piecesSubtotal(pieces);
    // Pools moved into pieces v2 — no document-global pool to add anymore.
    expect(sum.ars).toBe(1306000 + 812000);
    expect(sum.usd).toBe(1306 + 812);
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
