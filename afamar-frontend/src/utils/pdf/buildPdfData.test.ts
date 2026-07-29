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
  pool_id: null as number | null,
  pool_price: 0,
  pool_currency: 'ARS',
  pool_image: null as string | null,
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
  balance_paid_at: null as string | null,
  payment_method: 'EFECTIVO',
  installments: 1,
  validity_days: 15,
  estimated_delivery: '',
  estimated_date: null as string | null,
  priority: 'NORMAL',
  delivery_date: null as string | null,
  delivery_address_id: null as number | null,
  digital_signature: null as string | null,
  signed_at: null as string | null,
  approval_date: null as string | null,
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

describe('buildPdfData — discount and surcharge', () => {
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

  it('applies percentage discount to the subtotal+transport base', () => {
    const fabrication_details = [
      { concept: 'LENGTH', detail: '', length: 1, width: 0, m2: 1, labor: 0, currency: 'ARS', quantity: 1, price: 10000 },
    ];
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({ fabrication_details, transport: 1000, discount_percentage: 10 }),
      overrides: {},
    });
    // subtotal=10000, transport=1000 → base=11000, discount=1100
    expect(data.discount_fixed_amount).toBe(1100);
    expect(data.discount_percentage).toBe(10);
    expect(data.total).toBe(9900); // 11000 - 1100
  });

  it('applies fixed amount discount (takes precedence over percentage)', () => {
    const fabrication_details = [
      { concept: 'LENGTH', detail: '', length: 1, width: 0, m2: 1, labor: 0, currency: 'ARS', quantity: 1, price: 10000 },
    ];
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({ fabrication_details, transport: 0, discount_fixed_amount: 2500, discount_percentage: 50 }),
      overrides: {},
    });
    // fixed 2500 wins over 50% (5_000)
    expect(data.discount_fixed_amount).toBe(2500);
    expect(data.total).toBe(7500); // 10000 - 2500
  });

  it('adds 0% surcharge for 1-2 installments even when payment method is credit card', () => {
    const fabrication_details = [
      { concept: 'LENGTH', detail: '', length: 1, width: 0, m2: 1, labor: 0, currency: 'ARS', quantity: 1, price: 10000 },
    ];
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({ fabrication_details, payment_method: 'TARJETA DE CRÉDITO', installments: 2 }),
      overrides: {},
    });
    expect(data.surcharge_percentage).toBe(0);
    expect(data.surcharge_amount).toBe(0);
    expect(data.total).toBe(10000);
  });

  it('adds 15% surcharge for 3 installments on credit card', () => {
    const fabrication_details = [
      { concept: 'LENGTH', detail: '', length: 1, width: 0, m2: 1, labor: 0, currency: 'ARS', quantity: 1, price: 10000 },
    ];
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({ fabrication_details, payment_method: 'TARJETA DE CRÉDITO', installments: 3 }),
      overrides: {},
    });
    expect(data.surcharge_percentage).toBe(15);
    expect(data.surcharge_amount).toBe(1500);
    expect(data.total).toBe(11500);
  });

  it('subtracts deposit_received from total in balance_due', () => {
    const fabrication_details = [
      { concept: 'LENGTH', detail: '', length: 1, width: 0, m2: 1, labor: 0, currency: 'ARS', quantity: 1, price: 10000 },
    ];
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({ fabrication_details, deposit_received: 3000 }),
      overrides: {},
    });
    expect(data.total).toBe(10000);
    expect(data.balance_due).toBe(7000);
  });
});

describe('buildPdfData — terms overrides', () => {
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
    sketchImages: [],
  };

  it('uses override terms when provided for budget', () => {
    const data = buildPdfData({
      ...baseParams,
      form: makeForm(),
      globalTerms: { budget_terms: ['Global budget term'], delivery_terms: [], warranty_text: [] },
      overrides: { budget_terms: ['Override budget term'] },
    });
    expect(data.budget_terms_list).toEqual(['Override budget term']);
  });

  it('falls back to global terms when override is empty', () => {
    const data = buildPdfData({
      ...baseParams,
      form: makeForm(),
      globalTerms: { budget_terms: ['Global term'], delivery_terms: ['Global delivery'], warranty_text: ['Global warranty'] },
      overrides: {},
    });
    expect(data.budget_terms_list).toEqual(['Global term']);
    expect(data.delivery_terms_list).toEqual(['Global delivery']);
    expect(data.warranty_terms_list).toEqual(['Global warranty']);
  });

  it('uses override terms for work order (delivery + warranty)', () => {
    const data = buildPdfData({
      ...baseParams,
      document_type: 'work_order',
      form: makeForm(),
      globalTerms: { budget_terms: [], delivery_terms: ['Global delivery'], warranty_text: ['Global warranty'] },
      overrides: { delivery_terms: ['Override delivery'], warranty_terms: ['Override warranty'] },
    });
    expect(data.delivery_terms_list).toEqual(['Override delivery']);
    expect(data.warranty_terms_list).toEqual(['Override warranty']);
  });
});

describe('buildPdfData — edge cases', () => {
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

  it('renders an empty form without crashing (subtotal=0, total=0)', () => {
    const data = buildPdfData({
      ...baseParams,
      form: makeForm(),
      overrides: {},
    });
    expect(data.subtotal).toBe(0);
    expect(data.total).toBe(0);
    expect(data.balance_due).toBe(0);
  });

  it('does not crash on malformed additional_works_data JSON', () => {
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({ additional_works_data: '{malformed' }),
      overrides: {},
    });
    expect(data.additional_works).toEqual([]);
    expect(data.additional_works_subtotal_ars).toBe(0);
    expect(data.additional_works_subtotal_usd).toBe(0);
  });

  it('work_order document_type does NOT include alternative sections', () => {
    const data = buildPdfData({
      ...baseParams,
      document_type: 'work_order',
      form: makeForm({ materials_data: materialsWithAlt }),
      overrides: {},
    });
    // For work orders, only the main section is rendered (no alternatives).
    const mainSection = data.sections.find((s) => s.is_main);
    expect(mainSection).toBeDefined();
    const altSection = data.sections.find((s) => !s.is_main);
    expect(altSection).toBeUndefined();
  });

  it('title is PRESUPUESTO for budget and ORDEN DE TRABAJO for work_order', () => {
    const budget = buildPdfData({ ...baseParams, form: makeForm(), overrides: {} });
    const wo = buildPdfData({ ...baseParams, document_type: 'work_order', form: makeForm(), overrides: {} });
    expect(budget.title).toBe('PRESUPUESTO');
    expect(wo.title).toBe('ORDEN DE TRABAJO');
  });
});
