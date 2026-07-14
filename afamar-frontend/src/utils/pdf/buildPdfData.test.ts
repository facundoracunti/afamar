import { describe, expect, it } from 'vitest';
import { buildPdfData } from './buildPdfData';
import type { MaterialInForm, PoolInForm } from '../../types/budget';

const formBase = {
  number: 'P-TEST-1',
  date: '2026-01-01',
  client_name: 'Cliente Test',
  client_phone: '',
  client_address: '',
  client_email: '',
  material: 'Negro Brasil',
  material_price_m2: 0,
  material_price_m2_usd: 330,
  materials_data: [] as unknown as unknown[],
  color: '',
  thickness: '',
  finish: '',
  bacha: '',
  anafe: '',
  pool_id: null,
  pool_price: 0,
  pool_currency: 'ARS',
  pool_image: null,
  pools_data: [] as unknown as PoolInForm[],
  fabrication_details: [] as unknown as unknown[],
  sketch_elements: [] as unknown as unknown[],
  notes: '',
  design_observations: '',
  important_observations: '',
  currency: 'USD',
  usd_rate: 1000,
  transport: 0,
  transport_usd: 0,
  installation: 0,
  discount: 0,
  discount_percentage: 0,
  discount_fixed_amount: 0,
  subtotal: 0,
  total: 0,
  subtotal_usd: 0,
  total_usd: 0,
  deposit_received: 0,
  deposit_currency: 'ARS',
  deposit_usd: 0,
  balance_due: 0,
  balance_due_usd: 0,
  balance_paid: false,
  balance_paid_at: null,
  payment_method: 'EFECTIVO',
  installments: 1,
  validity_days: 15,
  estimated_delivery: '',
  estimated_date: null,
  priority: 'NORMAL',
  delivery_date: null,
  delivery_address_id: null,
  digital_signature: null,
  signed_at: null,
  approval_date: null,
  status: 'PENDING',
  status_id: 1,
  payment_method_id: 1,
  priority_id: 1,
  finish_id: 1,
  budget_terms_override: '[]',
  warranty_override: '[]',
  stock_deducted: false,
  additional_works_data: '[]',
  created_at: '',
  updated_at: '',
};

const materialsWithAlt = [
  {
    id: 1,
    name: 'Negro Brasil',
    price_m2: 200000,
    price_m2_usd: 330,
    currency: 'USD',
    quantity: 1,
    m2_used: 0,
    m2_budgeted: 0,
    length: 0,
    width: 0,
    is_alternative: false,
  },
  {
    id: 2,
    name: 'Marmol Carrara',
    price_m2: 250000,
    price_m2_usd: 410,
    currency: 'USD',
    quantity: 1,
    m2_used: 0,
    m2_budgeted: 0,
    length: 0,
    width: 0,
    is_alternative: true,
  },
] satisfies MaterialInForm[];

function makeForm(extra: Record<string, unknown> = {}) {
  return { ...formBase, ...extra } as unknown as Parameters<typeof buildPdfData>[0]['form'];
}

describe('buildPdfData — additional works per-section routing', () => {
  it('puts global adicionais in every section', () => {
    const additional_works_data = JSON.stringify([
      {
        additional_work_id: 99,
        name: 'Traslado',
        price: 100,
        currency: 'ARS',
        quantity: 1,
        total: 100,
        materialName: '__GLOBAL__',
        type: 'flat',
      },
    ]);
    const data = buildPdfData({
      form: makeForm({
        materials_data: materialsWithAlt,
        additional_works_data,
      }),
      document_type: 'budget',
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
      overrides: {},
      sketchImages: [],
    });
    expect(data.sections).toHaveLength(2);
    // Traslado global goes in main section
    expect(data.sections[0].additional_works.find((a) => a.name === 'Traslado')).toBeDefined();
    // Traslado global also goes in alternativa section
    expect(data.sections[1].additional_works.find((a) => a.name === 'Traslado')).toBeDefined();
  });

  it('routes a principal frente to the main section only', () => {
    const additional_works_data = JSON.stringify([
      {
        additional_work_id: 24,
        name: 'Frente / Regrueso',
        price: 44.05,
        currency: 'USD',
        quantity: 1,
        total: 129.07,
        materialName: 'Negro Brasil',
        type: 'frente',
        linear_meters: 2.93,
        assigned_material_id: 1,
        formula_values: {
          material_price_m2_at_selection: 330,
          multiplier: 1.15,
        },
      },
    ]);
    const data = buildPdfData({
      form: makeForm({ materials_data: materialsWithAlt, additional_works_data }),
      document_type: 'budget',
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
      overrides: {},
      sketchImages: [],
    });
    // The principal's frente should be in the main section
    const mainSection = data.sections.find((s) => s.is_main);
    expect(mainSection).toBeDefined();
    expect(mainSection!.additional_works.some((a) => a.type === 'frente')).toBe(true);
    // And NOT in the alternativa section
    const altSection = data.sections.find((s) => !s.is_main);
    expect(altSection).toBeDefined();
    expect(altSection!.additional_works.some((a) => a.type === 'frente')).toBe(false);
  });

  it('does NOT duplicate pools/fabrication/additionals when two main materials share the same name', () => {
    const duplicateMainMaterials = [
      {
        id: 1,
        name: 'Gris Mara',
        price_m2: 200000,
        price_m2_usd: 330,
        currency: 'USD',
        quantity: 1,
        m2_used: 2.0,
        m2_budgeted: 2.0,
        length: 200,
        width: 100,
        is_alternative: false,
      },
      {
        id: 3,
        name: 'Gris Mara',
        price_m2: 200000,
        price_m2_usd: 330,
        currency: 'USD',
        quantity: 1,
        m2_used: 1.5,
        m2_budgeted: 1.5,
        length: 150,
        width: 100,
        is_alternative: false,
      },
    ] satisfies MaterialInForm[];

    const pools_data = [
      { pool_id: 10, name: 'Pileta Rectangular', price: 50000, currency: 'ARS', quantity: 1 },
    ] as unknown as PoolInForm[];

    const additional_works_data = JSON.stringify([
      {
        additional_work_id: 24,
        name: 'Frente / Regrueso',
        price: 44.05,
        currency: 'USD',
        quantity: 1,
        total: 129.07,
        materialName: 'Gris Mara',
        type: 'frente',
        linear_meters: 2.93,
        assigned_material_id: 1,
      },
    ]);

    const data = buildPdfData({
      form: makeForm({
        materials_data: duplicateMainMaterials,
        pools_data,
        additional_works_data,
      }),
      document_type: 'budget',
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
      overrides: {},
      sketchImages: [],
    });

    const mainSection = data.sections.find((s) => s.is_main);
    expect(mainSection).toBeDefined();
    // 1 pool, not 2 (was duplicated before the fix)
    expect(mainSection!.pools).toHaveLength(1);
    // 1 frente, not 2
    expect(mainSection!.additional_works.filter((a) => a.type === 'frente')).toHaveLength(1);
    // 2 material rows (both Gris Mara panes — correct, these are distinct rows)
    expect(mainSection!.materials).toHaveLength(2);
  });

  it('routes an alternativa frente to the alternativa section using the __ALT__: sentinel', () => {
    const additional_works_data = JSON.stringify([
      {
        additional_work_id: 24,
        name: 'Frente / Regrueso',
        price: 50.45,
        currency: 'USD',
        quantity: 1,
        total: 147.83,
        materialName: '__ALT__:Marmol Carrara',
        type: 'frente',
        linear_meters: 2.93,
        assigned_material_id: 2,
        formula_values: {
          material_price_m2_at_selection: 410,
          multiplier: 1.15,
        },
      },
    ]);
    const data = buildPdfData({
      form: makeForm({ materials_data: materialsWithAlt, additional_works_data }),
      document_type: 'budget',
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
      overrides: {},
      sketchImages: [],
    });
    const altSection = data.sections.find((s) => s.alternative_index === 0);
    expect(altSection).toBeDefined();
    expect(altSection!.additional_works.some((a) => a.type === 'frente')).toBe(true);
    const mainSection = data.sections.find((s) => s.is_main);
    expect(mainSection).toBeDefined();
    expect(mainSection!.additional_works.some((a) => a.type === 'frente')).toBe(false);
  });
});
