// The project intentionally does not include @types/node; Vitest supplies
// these Node modules at runtime for the artifact-generation regression.
// @ts-expect-error Vitest's Node runtime module.
import { mkdirSync, writeFileSync } from 'node:fs';
// @ts-expect-error Vitest's Node runtime module.
import { tmpdir } from 'node:os';
// @ts-expect-error Vitest's Node runtime module.
import { join } from 'node:path';
import { renderToBuffer } from '@react-pdf/renderer';
import { describe, expect, it } from 'vitest';
import DocumentPdf from '../../components/ui/PdfPreviewModal/DocumentPdf';
import { buildPdfData } from './buildPdfData';
import type { BudgetPiece, MaterialInForm } from '../../types/budget';

const outputDir = join(tmpdir(), 'afamar-react-pdf-approval-validation-corrected');
const company = {
  company_name: 'AFAMAR', company_tagline: 'MÁRMOLES & GRANITOS', company_address: 'Córdoba',
  company_phone: '351', company_email: 'afamar@afamar.com', company_logo: '', pdf_footer: 'AFAMAR',
};
const globalTerms = { budget_terms: [], delivery_terms: [], warranty_text: [] };

function material(extra: Partial<MaterialInForm>): MaterialInForm {
  return {
    id: null, name: 'Material', category: '', color: '', price_m2: 0, price_m2_usd: 0,
    currency: 'ARS', quantity: 1, m2_used: 0, m2_budgeted: 0, length: 1, width: 1,
    is_alternative: false, ...extra,
  };
}

function piece(id: string, name: string, mainMaterial: MaterialInForm): BudgetPiece {
  return {
    id, name, mainMaterial, mainMaterialRows: [], alternativeMaterials: [],
    fabrication_details: [], additional_works_data: '[]', pools: [],
  };
}

function approval(pieces: Array<{ piece: BudgetPiece; native: number; ars: number; usd: number }>, rate: number, id = 2) {
  return {
    id,
    approval_breakdown: {
      version: 1,
      usd_rate: rate,
      pieces: pieces.map(({ piece: p, native, ars, usd }) => ({
        piece_key: `piece:${p.id}`,
        piece_id: p.id,
        name: p.name,
        lines: [{
          line_key: `material:${p.id}`,
          line_kind: 'material',
          concept_type: 'MATERIAL',
          measurement_approved: {
            length: p.mainMaterial?.length,
            width: p.mainMaterial?.width,
            quantity: p.mainMaterial?.quantity,
          },
          subtotal_approved: { ars, usd, native, currency: p.mainMaterial?.currency || 'ARS' },
        }],
        subtotal_approved: { ars, usd, native, currency: p.mainMaterial?.currency || 'ARS' },
      })),
      global_lines: [],
      total_approved: {
        ars: pieces.reduce((sum, p) => sum + p.ars, 0),
        usd: pieces.reduce((sum, p) => sum + p.usd, 0),
        native: pieces.reduce((sum, p) => sum + p.native, 0),
        currency: 'ARS',
      },
    },
  };
}

function form(pieces: BudgetPiece[], rate: number, approvals: unknown[], commercial: { ars: number; usd: number }) {
  return {
    number: 'A-VALID-001', date: '2026-10-30', client_name: 'Cliente Sintético',
    client_phone: '+54 11 5555-0199', client_address: 'Domicilio sintético 456',
    client_email: 'cliente@sintetico.test', status: 'MEASUREMENT', usd_rate: rate,
    pieces, materials_data: [], fabrication_details: [], additional_works_data: '[]', pools_data: [],
    transport: 0, transport_usd: 0, discount_percentage: 0, discount_fixed_amount: 0,
    discount_enabled: false, discount_target: 'total', payment_method: 'EFECTIVO', installments: 1,
    deposit_received: 250000, deposit_currency: 'ARS', deposit_usd: 0, balance_paid: false,
    balance_paid_at: null, measurement_approvals: approvals,
    subtotal: commercial.ars, total: commercial.ars,
    subtotal_usd: commercial.usd, total_usd: commercial.usd,
    balance_due: commercial.ars - 250000, balance_due_usd: commercial.usd - (250000 / rate),
  } as unknown as Record<string, unknown>;
}

async function renderScenario(filename: string, pieces: BudgetPiece[], rate: number, approvals: unknown[], commercial: { ars: number; usd: number }) {
  const data = buildPdfData({
    form: form(pieces, rate, approvals, commercial), document_type: 'work_order', company, globalTerms,
    usePersistedCommercialTotals: true,
  });
  const buffer = await renderToBuffer(<DocumentPdf data={data} />);
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, filename), buffer);
  return data;
}

describe('React-PDF approval unit-price currency coherence', () => {
  it('keeps approved subtotals, payments and balances while generating all three validation PDFs', async () => {
    const scenarioA = piece('a', 'UNA PIEZA', material({ name: 'SILESTONE USD', currency: 'USD', price_m2_usd: 500, length: 1, width: 1, m2_budgeted: 1 }));
    const scenarioBUsd = piece('b-usd', 'PIEZA USD', material({ name: 'SILESTONE USD', currency: 'USD', price_m2_usd: 500, length: 1, width: 1, m2_budgeted: 1 }));
    const scenarioBArs = piece('b-ars', 'PIEZA ARS', material({ name: 'MÁRMOL ARS', currency: 'ARS', price_m2: 300000, length: 1, width: 1, m2_budgeted: 1 }));
    const scenarioC = piece('c', 'MEDICIÓN SUCESIVA', material({
      name: 'SILESTONE USD', currency: 'USD', price_m2: 729166.67, price_m2_usd: 729166.67,
      length: 1.2, width: 1.2, m2_budgeted: 1.44,
    }));

    const dataA = await renderScenario('scenario-a-one-piece.pdf', [scenarioA], 1200, [approval([{ piece: scenarioA, native: 500, ars: 600000, usd: 500 }], 1200)], { ars: 600000, usd: 500 });
    const dataB = await renderScenario('scenario-b-multiple-pieces.pdf', [scenarioBUsd, scenarioBArs], 1200, [approval([
      { piece: scenarioBUsd, native: 500, ars: 600000, usd: 500 },
      { piece: scenarioBArs, native: 300000, ars: 300000, usd: 250 },
    ], 1200)], { ars: 900000, usd: 750 });
    const dataC = await renderScenario('scenario-c-successive-approvals.pdf', [scenarioC], 1200, [
      approval([{ piece: scenarioC, native: 800, ars: 960000, usd: 800 }], 1200, 1),
      approval([{ piece: scenarioC, native: 875, ars: 1050000, usd: 875 }], 1200, 2),
    ], { ars: 1050000, usd: 875 });

    expect(dataA.pieces?.[0].materials[0].currency).toBe('USD');
    expect(dataB.pieces?.map((p) => p.materials[0].currency)).toEqual(['USD', 'ARS']);
    expect(dataC.pieces?.[0].materials[0]).toEqual(expect.objectContaining({
      currency: 'USD', price_m2_str: '607,64', subtotal_ars: 1050000, subtotal_usd: 875,
    }));
    expect(dataC.deposit_received).toBe(250000);
    expect(dataC.balance_due).toBe(dataC.total - 250000);
  }, 20_000);
});
