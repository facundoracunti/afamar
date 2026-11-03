import { renderToBuffer } from '@react-pdf/renderer';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import DocumentPdf from '../../components/ui/PdfPreviewModal/DocumentPdf';
import { INITIAL_FORM } from '../../hooks/entityFormConstants';
import { buildPdfData } from './buildPdfData';
import type { BudgetPiece } from '../../types/budget';
import { flattenPieces } from '@features/budgets/utils/pieces';

const COMPANY = {
  company_name: 'AFAMAR',
  company_tagline: 'MÁRMOLES & GRANITOS',
  company_address: 'Córdoba',
  company_phone: '351',
  company_email: 'afamar@test.local',
  company_logo: '',
  pdf_footer: '',
};

function pdfText(buffer: Uint8Array): string {
  const raw = new TextDecoder('latin1').decode(buffer);
  const parts: string[] = [];
  let cursor = 0;
  while (true) {
    const stream = raw.indexOf('stream', cursor);
    if (stream < 0) break;
    const end = raw.indexOf('endstream', stream);
    if (end < 0) break;
    let from = stream + 6;
    while (from < buffer.length && (buffer[from] === 10 || buffer[from] === 13)) from += 1;
    let to = end;
    while (to > from && (buffer[to - 1] === 10 || buffer[to - 1] === 13)) to -= 1;
    try {
      const inflated = new TextDecoder('latin1').decode(inflateSync(buffer.slice(from, to)));
      for (const match of inflated.matchAll(/<([0-9a-fA-F\s]+)>/g)) {
        const hex = match[1].replace(/\s+/g, '');
        let text = '';
        for (let i = 0; i < hex.length; i += 2) text += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
        parts.push(text);
      }
    } catch {
      // Ignore non-content streams.
    }
    cursor = end + 10;
  }
  return parts.join('').replace(/\s+/g, '');
}

describe('React-PDF commercial contractual total', () => {
  it('prints P-000012 total and USD from the persisted contractual snapshot', async () => {
    const form = {
      ...INITIAL_FORM,
      number: 'P-000012',
      date: '2026-11-02',
      client_name: 'Cliente sintético',
      usd_rate: 1565,
      subtotal: 1_105_808.40,
      subtotal_usd: 706.59,
      total: 1_105_808.40,
      total_usd: 706.59,
      total_exact_ars: 1_105_808.40,
      total_exact_usd: 706.59,
      rounding_adjustment_ars: 4_191.60,
      rounding_adjustment_usd: 2.68,
      total_contractual_ars: 1_110_000,
      total_contractual_usd: 709.27,
      balance_due: 1_110_000,
      balance_due_usd: 709.27,
      materials_data: [],
      pools_data: [],
      fabrication_details: [],
      additional_works_data: '[]',
      pieces: [],
    };
    const data = buildPdfData({
      form,
      document_type: 'budget',
      company: COMPANY,
      globalTerms: { budget_terms: [], delivery_terms: [], warranty_text: [] },
      overrides: {},
      usePersistedCommercialTotals: true,
    });

    const buffer = await renderToBuffer(<DocumentPdf data={data} />);
    const text = pdfText(buffer);

    expect(data.total).toBe(1_110_000);
    expect(data.total_usd).toBe(709.27);
    expect(text).toContain('1.110.000,00');
    expect(text).toContain('709,27');
    expect(text).not.toContain('4.191,60');
  });

  it('prints the same piece subtotal in the general subtotal and keeps the contractual total', async () => {
    const piece: BudgetPiece = {
      id: 'p-000012-piece',
      name: 'COCINA',
      mainMaterial: {
        id: 1,
        name: 'Material P-000012',
        price_m2: 740_808.40,
        price_m2_usd: 473.36,
        currency: 'ARS',
        quantity: 1,
        length: 1,
        width: 1,
        m2_used: 0,
        m2_budgeted: 1,
        is_alternative: false,
      },
      mainMaterialRows: [],
      alternativeMaterials: [],
      fabrication_details: [],
      additional_works_data: JSON.stringify([{
        name: 'Traforo',
        detail: '',
        currency: 'ARS',
        price: 60_000,
        quantity: 1,
        total: 60_000,
        type: 'flat',
        materialName: '__GLOBAL__',
      }]),
      pools: [{
        pool_id: 1,
        brand: 'JOHNSON',
        model: 'LUXOR',
        price: 305_000,
        currency: 'ARS',
        quantity: 1,
        material: '',
      }],
    };
    const flat = flattenPieces([piece]);
    const form = {
      ...INITIAL_FORM,
      number: 'P-000012',
      date: '2026-11-02',
      client_name: 'Cliente sintético',
      usd_rate: 1565,
      subtotal: 800_808.40,
      subtotal_usd: 512.02,
      total: 800_808.40,
      total_usd: 512.02,
      total_exact_ars: 1_105_808.40,
      total_exact_usd: 706.59,
      rounding_adjustment_ars: 4_191.60,
      rounding_adjustment_usd: 2.68,
      total_contractual_ars: 1_110_000,
      total_contractual_usd: 709.27,
      balance_due: 1_110_000,
      balance_due_usd: 709.27,
      materials_data: flat.materials_data,
      pools_data: flat.pools_data,
      fabrication_details: flat.fabrication_details,
      additional_works_data: flat.additional_works_data,
      pieces: [piece],
    };
    const data = buildPdfData({
      form,
      document_type: 'budget',
      company: COMPANY,
      globalTerms: { budget_terms: [], delivery_terms: [], warranty_text: [] },
      overrides: {},
      usePersistedCommercialTotals: true,
    });

    const buffer = await renderToBuffer(<DocumentPdf data={data} />);
    const text = pdfText(buffer);

    expect(data.pieces?.[0].subtotal_ars).toBe(1_105_808.40);
    expect(data.subtotal).toBe(1_105_808.40);
    expect(data.total).toBe(1_110_000);
    expect(data.total_usd).toBe(709.27);
    expect(text).not.toContain('SubtotalPieza');
    expect(text).not.toContain('Subtotal$1.105.808,40');
    expect(text).toContain('MaterialP-000012');
    expect(text).toContain('Traforo');
    expect(text).toContain('JOHNSON');
    expect(text).toContain('TOTAL$1.110.000,00');
    expect(text).toContain('709,27');
  }, 20_000);
});
