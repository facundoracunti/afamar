import { describe, expect, it } from 'vitest';
import { buildPdfData } from './buildPdfData';
import type { MaterialInForm, PoolInForm } from '../../types/budget';
import type { PaymentMethod } from '../../types/paymentMethod';

/**
 * Catalogue fixture mirroring the 4 default rows seeded by
 * `scripts/seeders/payment_methods.py`. Only the credit-card row is
 * relevant for the surcharge tests below; the others are kept for
 * completeness so the table-driven branches in `buildPdfData` see
 * the same shape the production data has.
 */
const PAYMENT_METHODS: PaymentMethod[] = [
  { id: 1, name: 'EFECTIVO', label: 'Efectivo', color: null, is_active: true, sort_order: 10, type: 'NONE', value: 0, is_percentage: false, applies_to_installments: false, created_at: null, updated_at: null },
  { id: 2, name: 'TRANSFERENCIA BANCARIA', label: 'Transferencia bancaria', color: null, is_active: true, sort_order: 20, type: 'NONE', value: 0, is_percentage: false, applies_to_installments: false, created_at: null, updated_at: null },
  { id: 3, name: 'TARJETA DE DÉBITO', label: 'Tarjeta de débito', color: null, is_active: true, sort_order: 30, type: 'NONE', value: 0, is_percentage: false, applies_to_installments: false, created_at: null, updated_at: null },
  { id: 4, name: 'TARJETA DE CRÉDITO', label: 'Tarjeta de crédito', color: null, is_active: true, sort_order: 40, type: 'SURCHARGE', value: 9, is_percentage: true, applies_to_installments: true, created_at: null, updated_at: null },
];

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
  discount_enabled: false,
  discount_target: 'total',
  discount_amount: 0,
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

describe('buildPdfData — grouped alternative sections', () => {
  it('collapses multiple panes of the same alternative material into ONE section', () => {
    const altMaterials = [
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
        length: 2,
        width: 1,
        is_alternative: true,
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
        length: 1.5,
        width: 1,
        is_alternative: true,
      },
      {
        id: 3,
        name: 'Gris Mara',
        price_m2: 200000,
        price_m2_usd: 330,
        currency: 'USD',
        quantity: 1,
        m2_used: 0,
        m2_budgeted: 0,
        length: 2,
        width: 1,
        is_alternative: true,
      },
    ] satisfies MaterialInForm[];

    const data = buildPdfData({
      form: makeForm({ materials_data: altMaterials }),
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

    const sections = data.sections.filter((s) => !s.is_main);
    expect(sections).toHaveLength(2);
    const carrara = sections.find((s) => s.material_name === 'Marmol Carrara');
    expect(carrara).toBeDefined();
    // Both panes of the same alternative material live in ONE section
    expect(carrara!.materials).toHaveLength(2);
    expect(carrara!.title).toBe('ALTERNATIVA 1: Marmol Carrara');
    expect(carrara!.alternative_index).toBe(0);
    const gris = sections.find((s) => s.material_name === 'Gris Mara');
    expect(gris).toBeDefined();
    expect(gris!.title).toBe('ALTERNATIVA 2: Gris Mara');
    expect(gris!.alternative_index).toBe(1);
  });

  it('keeps the principal section intact when alternatives are grouped', () => {
    const data = buildPdfData({
      form: makeForm({ materials_data: materialsWithAlt }),
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
    expect(mainSection!.materials).toHaveLength(1);
    expect(data.sections.filter((s) => !s.is_main)).toHaveLength(1);
  });

  it('renders NO GLOBAL section when there is no main material but alternatives exist', () => {
    // All materials are alternatives (the operator never picked a principal).
    // A pileta + traforos are marked __GLOBAL__ (common works). These must be
    // folded into each alternativa — NOT emitted as a standalone GLOBAL section,
    // which would duplicate them.
    const onlyAltMaterials = [
      { id: 21, name: 'BLANCO SUGGAR', price_m2: 335000, price_m2_usd: 335, currency: 'USD', quantity: 1, m2_used: 0, m2_budgeted: 0, length: 1.5, width: 0.5, is_alternative: true },
      { id: 22, name: 'ABSOLUTE WHITE', price_m2: 400000, price_m2_usd: 400, currency: 'USD', quantity: 1, m2_used: 0, m2_budgeted: 0, length: 1.5, width: 0.5, is_alternative: true },
    ] satisfies MaterialInForm[];
    const pools_data = JSON.stringify([
      { pool_id: 10, brand: 'JOHNSON', model: 'LUXOR', price: 280000, currency: 'ARS', quantity: 1, material: '__GLOBAL__' },
    ]);
    const additional_works_data = JSON.stringify([
      { additional_work_id: 2, name: 'Traforo de Anafe', price: 70000, currency: 'ARS', quantity: 1, total: 70000, materialName: '__GLOBAL__', type: 'flat' },
    ]);

    const data = buildPdfData({
      form: makeForm({ materials_data: onlyAltMaterials, pools_data, additional_works_data }),
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

    // No synthetic GLOBAL section.
    expect(data.sections.find((s) => s.is_global)).toBeUndefined();
    // The common pileta + traforo are folded into EVERY alternativa.
    const altSections = data.sections.filter((s) => !s.is_main);
    expect(altSections).toHaveLength(2);
    for (const alt of altSections) {
      expect(alt.pools.find((p) => p.brand === 'JOHNSON')).toBeDefined();
      expect(alt.additional_works.find((a) => a.name === 'Traforo de Anafe')).toBeDefined();
    }
    // The document-level subtotal uses the FIRST alternative as the
    // representative (app-wide convention): its material cost
    // (0.75 m² × USD 335 × 1000 = 251.250) + pileta 280.000 + traforo 70.000.
    expect(data.subtotal).toBe(601250);

    // Every alternative is a self-contained quote: each section carries its
    // OWN final total (dólar del día, TOTAL, saldo) so the PDF renders a
    // totals block per alternative regardless of how many there are.
    // BLANCO SUGGAR → 601.250, ABSOLUTE WHITE → 300.000 + 280.000 + 70.000 = 650.000.
    const suger = altSections.find((s) => s.material_name === 'BLANCO SUGGAR');
    const white = altSections.find((s) => s.material_name === 'ABSOLUTE WHITE');
    expect(suger?.subtotal_ars).toBe(601250);
    expect(suger?.total_ars).toBe(601250);
    expect(white?.subtotal_ars).toBe(650000);
    expect(white?.total_ars).toBe(650000);
    // Totals are distinct per alternative — not a shared document-level value.
    expect(white?.total_ars).not.toBe(suger?.total_ars);
    // USD side is computed per section too.
    expect(suger?.total_usd).toBeGreaterThan(0);
    expect(white?.total_usd).toBeGreaterThan(0);
  });

  it('keeps a GLOBAL section only when there is no main material AND no alternatives', () => {
    // Degenerate case: only a global pool, no material nor alternative rows.
    const pools_data = JSON.stringify([
      { pool_id: 10, brand: 'JOHNSON', model: 'LUXOR', price: 280000, currency: 'ARS', quantity: 1, material: '__GLOBAL__' },
    ]);
    const data = buildPdfData({
      form: makeForm({ materials_data: [], pools_data }),
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
    const global = data.sections.find((s) => s.is_global);
    expect(global).toBeDefined();
    expect(global!.pools.find((p) => p.brand === 'JOHNSON')).toBeDefined();
  });

  it('revalues a global ZÓCALO and a global frente per alternative material (alternatives-only budget)', () => {
    // P-000004 regression: an alternatives-only budget (ZIRCONIUM USD +
    // GRIS MARA ARS) with a GLOBAL zócalo (BASEBOARD, empty material, price
    // 0) and a GLOBAL frente (no assigned material, price 0). Both must pick
    // up each option's own material value instead of rendering "sin ningún
    // valor" ($0) in the PDF.
    const onlyAltMaterials = [
      { id: 27, name: 'ZIRCONIUM', price_m2: 750000, price_m2_usd: 750, currency: 'USD', quantity: 1, m2_used: 0, m2_budgeted: 0, length: 2.1, width: 0.6, is_alternative: true },
      { id: 27, name: 'ZIRCONIUM', price_m2: 750000, price_m2_usd: 750, currency: 'USD', quantity: 1, m2_used: 0, m2_budgeted: 0, length: 1.54, width: 0.55, is_alternative: true },
      { id: 1, name: 'GRIS MARA', price_m2: 180000, price_m2_usd: 180, currency: 'ARS', quantity: 1, m2_used: 0, m2_budgeted: 0, length: 2.1, width: 0.6, is_alternative: true },
      { id: 1, name: 'GRIS MARA', price_m2: 180000, price_m2_usd: 180, currency: 'ARS', quantity: 1, m2_used: 0, m2_budgeted: 0, length: 1.54, width: 0.55, is_alternative: true },
    ] satisfies MaterialInForm[];
    const fabrication_details = JSON.stringify([
      { concept: 'BASEBOARD', detail: '', material: '', material_price_m2: 0, length: 3.3, width: 0.1, m2: 0.33, quantity: 1, currency: 'ARS', price: 0 },
    ]);
    const adicionales = JSON.stringify([
      // Flat global work: keeps its own price in EVERY alternative.
      { additional_work_id: 1, name: 'Traforo de Pileta', detail: 'Apertura y pegado de pileta', price: 60000, currency: 'ARS', quantity: 1, total: 60000, materialName: '__GLOBAL__', type: 'flat' },
      // GLOBAL frente (no material): takes each alternative's material value.
      // Mirrors budget-4: a stale `materialName: "ZIRCONIUM"` with an unassigned
      // `assigned_material_id: null` — the row still renders as global and shows
      // in EVERY option (ZIRCONIUM *and* GRIS MARA).
      { additional_work_id: 6, name: 'Frente Ingletetado 45', detail: 'Frente 45', price: 0, currency: 'USD', quantity: 1, total: 0, materialName: 'ZIRCONIUM', type: 'frente', linear_meters: 3.3, assigned_material_id: null, formula_values: null },
    ]);

    const data = buildPdfData({
      form: makeForm({ materials_data: onlyAltMaterials, fabrication_details, additional_works_data: adicionales, usd_rate: 1000 }),
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

    const sard = data.sections.find((s) => s.material_name === 'ZIRCONIUM');
    const mara = data.sections.find((s) => s.material_name === 'GRIS MARA');
    expect(sard).toBeDefined();
    expect(mara).toBeDefined();

    // ZÓCALO — same geometric row, valued with each option's material.
    const sardZocalo = sard!.fabrication_details.find((f) => f.m2 === 0.33);
    const maraZocalo = mara!.fabrication_details.find((f) => f.m2 === 0.33);
    expect(sardZocalo).toBeDefined();
    expect(maraZocalo).toBeDefined();
    // ZIRCONIUM (USD): 0.33 m² × 750 USD = 247.50 USD.
    expect(sardZocalo!.subtotal_usd).toBeCloseTo(247.5);
    expect(sardZocalo!.subtotal_ars).toBeCloseTo(247500);
    expect(sardZocalo!.currency).toBe('USD');
    // GRIS MARA (ARS): 0.33 m² × 180000 ARS = 59.400 ARS.
    expect(maraZocalo!.subtotal_ars).toBeCloseTo(59400);
    expect(maraZocalo!.currency).toBe('ARS');

    // GLOBAL FRENTE — revalued with each option's material too.
    // price/ml = price_m² × 0.13 × 1.15 ; total = × linear_meters (3.3)
    const sardFrente = sard!.additional_works.find((a) => a.type === 'frente');
    const maraFrente = mara!.additional_works.find((a) => a.type === 'frente');
    expect(sardFrente).toBeDefined();
    expect(maraFrente).toBeDefined();
    expect(sardFrente!.subtotal_usd).toBeCloseTo(370.01); // 750 × 0.1495 × 3.3
    expect(maraFrente!.subtotal_ars).toBeCloseTo(88803);  // 180000 × 0.1495 × 3.3

    // Flat global traforo keeps its own price in EVERY alternative.
    for (const alt of data.sections) {
      const traforo = alt.additional_works.find((a) => a.name === 'Traforo de Pileta');
      expect(traforo).toBeDefined();
      expect(traforo!.subtotal_ars).toBe(60000);
    }
  });

  it('revalues a GLOBAL frente AND zócalo in PRINCIPAL and every ALTERNATIVA when a main material exists', () => {
    // Budget-80 report: a budget with a principal material + alternatives and
    // a GLOBAL frente (selected via the additional-work card → "global") must
    // show the frente revalued with EACH section's material — PRINCIPAL vs the
    // main material, each ALTERNATIVA vs its own — exactly like a flat GLOBAL
    // additional work. Pre-fix this only happened for alternatives-only budgets
    // (`revalueForOptions` gate), so with a principal present the stored $0
    // subtotal made the frente invisible in the PDF.
    const mainAndAltMaterials = [
      { id: 1, name: 'Negro Brasil', price_m2: 330000, price_m2_usd: 330, currency: 'USD', quantity: 1, m2_used: 0, m2_budgeted: 0, length: 1, width: 1, is_alternative: false },
      { id: 27, name: 'ZIRCONIUM', price_m2: 750000, price_m2_usd: 750, currency: 'USD', quantity: 1, m2_used: 0, m2_budgeted: 0, length: 1, width: 1, is_alternative: true },
    ] satisfies MaterialInForm[];
    const fabrication_details = JSON.stringify([
      { concept: 'BASEBOARD', detail: '', material: '', material_price_m2: 0, length: 3.3, width: 0.1, m2: 0.33, quantity: 1, currency: 'ARS', price: 0 },
    ]);
    const adicionales = JSON.stringify([
      { additional_work_id: 6, name: 'Frente Ingletetado 45', detail: 'Frente 45', price: 0, currency: 'USD', quantity: 1, total: 0, materialName: '__GLOBAL__', type: 'frente', linear_meters: 3, assigned_material_id: null, formula_values: null },
    ]);

    const data = buildPdfData({
      form: makeForm({ materials_data: mainAndAltMaterials, fabrication_details, additional_works_data: adicionales, usd_rate: 1000 }),
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

    const main = data.sections.find((s) => s.is_main);
    const alt = data.sections.find((s) => s.material_name === 'ZIRCONIUM');
    expect(main).toBeDefined();
    expect(alt).toBeDefined();
    expect(data.sections).toHaveLength(2);

    // PRINCIPAL — revalued vs the main material (NEGRO BRASIL, USD 330/m²).
    // Zócalo: 0.33 m² × 330 → 108.90 USD. Frente: 330 × 0.13 × 1.15 × 3 → 148.01 USD.
    const mainZocalo = main!.fabrication_details.find((f) => f.m2 === 0.33);
    const mainFrente = main!.additional_works.find((a) => a.type === 'frente');
    expect(mainZocalo).toBeDefined();
    expect(mainFrente).toBeDefined();
    expect(mainZocalo!.subtotal_usd).toBeCloseTo(108.9);
    expect(mainZocalo!.subtotal_ars).toBeCloseTo(108900);
    expect(mainFrente!.subtotal_usd).toBeCloseTo(148.01);
    expect(mainFrente!.subtotal_ars).toBeCloseTo(148010);

    // ALTERNATIVA — revalued vs that option's material (ZIRCONIUM, USD 750/m²).
    // Zócalo: 0.33 × 750 → 247.50 USD. Frente: 750 × 0.13 × 1.15 × 3 → 336.37 USD.
    const altZocalo = alt!.fabrication_details.find((f) => f.m2 === 0.33);
    const altFrente = alt!.additional_works.find((a) => a.type === 'frente');
    expect(altZocalo).toBeDefined();
    expect(altFrente).toBeDefined();
    expect(altZocalo!.subtotal_usd).toBeCloseTo(247.5);
    expect(altZocalo!.subtotal_ars).toBeCloseTo(247500);
    expect(altFrente!.subtotal_usd).toBeCloseTo(336.37);
    expect(altFrente!.subtotal_ars).toBeCloseTo(336370);

    // The document-level subtotal is the PRINCIPAL section: 330.000 (material)
    // + 108.900 (zócalo) + 148.010 (frente) = 586.910 — the frente now counts.
    expect(main!.subtotal_ars).toBe(586910);
    expect(data.subtotal).toBe(586910);
  });

  it('revalues a GLOBAL frente against the single main material (main-only budget)', () => {
    const onlyMainMaterials = [
      { id: 1, name: 'Negro Brasil', price_m2: 330000, price_m2_usd: 330, currency: 'USD', quantity: 1, m2_used: 0, m2_budgeted: 0, length: 1, width: 1, is_alternative: false },
    ] satisfies MaterialInForm[];
    const adicionales = JSON.stringify([
      { additional_work_id: 6, name: 'Frente Ingletetado 45', detail: 'Frente 45', price: 0, currency: 'USD', quantity: 1, total: 0, materialName: '__GLOBAL__', type: 'frente', linear_meters: 3, assigned_material_id: null, formula_values: null },
    ]);

    const data = buildPdfData({
      form: makeForm({ materials_data: onlyMainMaterials, additional_works_data: adicionales, usd_rate: 1000 }),
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

    const main = data.sections.find((s) => s.is_main);
    expect(main).toBeDefined();
    expect(data.sections).toHaveLength(1);
    const frente = main!.additional_works.find((a) => a.type === 'frente');
    expect(frente).toBeDefined();
    // NEGRO BRASIL (USD 330/m²): total = 330 × 0.13 × 1.15 × 3 = 148.01 USD.
    expect(frente!.subtotal_usd).toBeCloseTo(148.01);
    expect(frente!.subtotal_ars).toBeCloseTo(148010);
    // 330.000 (material) + 148.010 (frente) = 478.010.
    expect(main!.subtotal_ars).toBe(478010);
    expect(data.subtotal).toBe(478010);
  });
});

describe('buildPdfData — measurement precision', () => {
  it('preserves measurements while keeping monetary values at two decimals', () => {
    const fabrication_details = [
      {
        concept: 'BASEBOARD',
        detail: '',
        length: 4,
        width: 0.105,
        m2: 0.42,
        labor: 0,
        currency: 'ARS',
        quantity: 1,
        price: 1234.5,
      },
    ];
    const data = buildPdfData({
      form: makeForm({ fabrication_details }),
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

    expect(data.fabrication_details[0].length_str).toBe('4 m');
    expect(data.fabrication_details[0].width_str).toBe('0,105 m');
    expect(data.fabrication_details[0].m2_label).toBe('0,42');
    expect(data.fabrication_details[0].price_str).toBe('1.234,50');
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
      form: makeForm({ fabrication_details, transport: 1000, discount_percentage: 10, discount_enabled: true }),
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

  it('does NOT apply the percentage discount when discount_enabled is off', () => {
    const fabrication_details = [
      { concept: 'LENGTH', detail: '', length: 1, width: 0, m2: 1, labor: 0, currency: 'ARS', quantity: 1, price: 10000 },
    ];
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({ fabrication_details, transport: 1000, discount_percentage: 10 }),
      overrides: {},
    });
    // Fase 3 gating: discount_enabled defaults to false → the 10% is ignored,
    // so the total equals the base (fixed-amount discounts stay ungated).
    expect(data.discount_fixed_amount).toBe(0);
    expect(data.total).toBe(11000);
  });

  it('applies the percentage over the WHOLE document with discount_target "total"', () => {
    const mats = [
      { id: 1, name: 'ZIRCONIUM', currency: 'ARS', price_m2: 100000, price_m2_usd: 0, quantity: 1, length: 1, width: 1, m2_used: 0, m2_budgeted: 0, is_alternative: false },
    ];
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({
        materials_data: mats,
        transport: 2000,
        discount_percentage: 10,
        discount_enabled: true,
        discount_target: 'total',
      }),
      overrides: {},
    });
    // base = materials(100000) + transport(2000) = 102000 → 10% = 10200
    expect(data.discount_fixed_amount).toBe(10200);
    expect(data.total).toBe(91800);
  });

  it('applies the percentage over the MAIN MATERIALS only with discount_target "materials"', () => {
    const mats = [
      { id: 1, name: 'ZIRCONIUM', currency: 'ARS', price_m2: 100000, price_m2_usd: 0, quantity: 1, length: 1, width: 1, m2_used: 0, m2_budgeted: 0, is_alternative: false },
      { id: 2, name: 'GRIS MARA', currency: 'ARS', price_m2: 20000, price_m2_usd: 0, quantity: 1, length: 1, width: 1, m2_used: 0, m2_budgeted: 0, is_alternative: true },
    ];
    const fabrication_details = [
      { concept: 'LENGTH', detail: '', length: 1, width: 0, m2: 1, labor: 0, currency: 'ARS', quantity: 1, price: 5000 },
    ];
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({
        materials_data: mats,
        fabrication_details,
        transport: 2000,
        discount_percentage: 10,
        discount_enabled: true,
        discount_target: 'materials',
      }),
      overrides: {},
    });
    // base = main materials only (100000; alternatives excluded) → 10% = 10000.
    // total = (100000 + 5000 + 2000) − 10000 = 97000
    expect(data.discount_fixed_amount).toBe(10000);
    expect(data.total).toBe(97000);
  });

  it('1 cuota adds 9% (base × 1.09)', () => {
    const fabrication_details = [
      { concept: 'LENGTH', detail: '', length: 1, width: 0, m2: 1, labor: 0, currency: 'ARS', quantity: 1, price: 10000 },
    ];
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({ fabrication_details, payment_method: 'TARJETA DE CRÉDITO', payment_method_id: 4, installments: 1 }),
      paymentMethods: PAYMENT_METHODS,
      overrides: {},
    });
    expect(data.surcharge_percentage).toBe(9);
    expect(data.surcharge_amount).toBe(900);
    expect(data.total).toBe(10900);
  });

  it('2 cuotas adds 18% (N × value): 10000 × 1.18 = 11800, cuota = 5900', () => {
    const fabrication_details = [
      { concept: 'LENGTH', detail: '', length: 1, width: 0, m2: 1, labor: 0, currency: 'ARS', quantity: 1, price: 10000 },
    ];
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({ fabrication_details, payment_method: 'TARJETA DE CRÉDITO', payment_method_id: 4, installments: 2 }),
      paymentMethods: PAYMENT_METHODS,
      overrides: {},
    });
    expect(data.surcharge_percentage).toBe(18);
    expect(data.surcharge_amount).toBe(1800);
    expect(data.total).toBe(11800);
  });

  it('3 cuotas adds 27% (N × value): 10000 × 1.27 = 12700, cuota = 4233.33', () => {
    const fabrication_details = [
      { concept: 'LENGTH', detail: '', length: 1, width: 0, m2: 1, labor: 0, currency: 'ARS', quantity: 1, price: 10000 },
    ];
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({ fabrication_details, payment_method: 'TARJETA DE CRÉDITO', payment_method_id: 4, installments: 3 }),
      paymentMethods: PAYMENT_METHODS,
      overrides: {},
    });
    expect(data.surcharge_percentage).toBe(27);
    expect(data.surcharge_amount).toBe(2700);
    expect(data.total).toBe(12700);
  });

  it('matches the customer-facing example: base=900000, 3 cuotas, value=9 → 1_143_000, cada cuota = 381_000', () => {
    const fabrication_details = [
      { concept: 'LENGTH', detail: '', length: 1, width: 0, m2: 1, labor: 0, currency: 'ARS', quantity: 1, price: 900000 },
    ];
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({ fabrication_details, payment_method: 'TARJETA DE CRÉDITO', payment_method_id: 4, installments: 3 }),
      paymentMethods: PAYMENT_METHODS,
      overrides: {},
    });
    expect(data.surcharge_amount).toBe(243000); // 900000 × 0.27
    expect(data.total).toBe(1143000); // 900000 × 1.27
  });

  it('emits catalogue_installment_detail with uniform rows (3 cuotas, base=900000)', () => {
    const fabrication_details = [
      { concept: 'LENGTH', detail: '', length: 1, width: 0, m2: 1, labor: 0, currency: 'ARS', quantity: 1, price: 900000 },
    ];
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({ fabrication_details, payment_method: 'TARJETA DE CRÉDITO', payment_method_id: 4, installments: 3 }),
      paymentMethods: PAYMENT_METHODS,
      overrides: {},
    });
    // total = 900000 × 1.27 = 1143000; cuota = 1143000 / 3 = 381000 (todas iguales)
    expect(data.catalogue_installment_detail).toEqual([
      { cuota: 1, interes: 9, monto: 381000 },
      { cuota: 2, interes: 9, monto: 381000 },
      { cuota: 3, interes: 9, monto: 381000 },
    ]);
  });

  it('emits empty catalogue_installment_detail for non-credit-card methods', () => {
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({ payment_method: 'EFECTIVO', payment_method_id: 1, installments: 1 }),
      paymentMethods: PAYMENT_METHODS,
      overrides: {},
    });
    expect(data.catalogue_installment_detail).toEqual([]);
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

  it('subtracts USD deposit (converted to ARS) from balance_due when deposit_currency is USD', () => {
    // Regression sentinel: the PDF preview's computeTotals used to
    // subtract only `deposit_received` (which is 0 when the seña is in
    // USD), so the saldo stayed frozen at total. It must now subtract
    // the ARS-equivalent (deposit_usd × usd_rate).
    const fabrication_details = [
      { concept: 'LENGTH', detail: '', length: 1, width: 0, m2: 1, labor: 0, currency: 'ARS', quantity: 1, price: 1000000 },
    ];
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({
        fabrication_details,
        deposit_received: 0,
        deposit_currency: 'USD',
        deposit_usd: 650,
        usd_rate: 1535,
        status: 'MEASUREMENT',
      }),
      overrides: {},
    });
    expect(data.deposit_currency).toBe('USD');
    expect(data.deposit_usd).toBe(650);
    expect(data.deposit_ars_equivalent).toBe(997750);
    // total = 1000000 ARS, deposit ARS equivalent = 997750 → balance_due = 2250
    expect(data.total).toBe(1000000);
    expect(data.balance_due).toBe(2250);
  });

  it('surfaces USD deposit with its ARS equivalent (deposit_ars_equivalent = usd × rate)', () => {
    // The customer paid a USD seña — the PDF preview renders the Seña row
    // with both currencies side by side (native USD + ARS equivalent).
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({
        deposit_received: 0,
        deposit_currency: 'USD',
        deposit_usd: 650,
        usd_rate: 1535,
        status: 'MEASUREMENT',
      }),
      overrides: {},
    });
    expect(data.deposit_currency).toBe('USD');
    expect(data.deposit_usd).toBe(650);
    expect(data.deposit_received).toBe(0);
    // 650 USD × 1535 = 997.750,00 ARS
    expect(data.deposit_ars_equivalent).toBeCloseTo(997750, 2);
  });

  it('keeps the total unchanged for a catalogue DISCOUNT method (informational)', () => {
    // The legacy promotional discount by payment method was removed: every
    // discount now flows through the commercial discount (Fase 3). Selecting
    // a method the catalogue marks as DISCOUNT must NOT reduce the totals —
    // the payment method stays a record of how the payment was collected.
    const fabrication_details = [
      { concept: 'LENGTH', detail: '', length: 1, width: 0, m2: 1, labor: 0, currency: 'ARS', quantity: 1, price: 10000 },
    ];
    const transferWithDiscount = PAYMENT_METHODS.map((pm) =>
      pm.name === 'TRANSFERENCIA BANCARIA'
        ? { ...pm, type: 'DISCOUNT' as const, value: 5, is_percentage: true }
        : pm
    );
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({
        fabrication_details,
        payment_method: 'TRANSFERENCIA BANCARIA',
        payment_method_id: 2,
        installments: 1,
      }),
      paymentMethods: transferWithDiscount,
      overrides: {},
    });
    expect(data.catalogue_discount_percentage).toBe(0);
    expect(data.catalogue_discount_amount).toBe(0);
    expect(data.total).toBe(10000);
  });

  it('ignores a FIXED-AMOUNT catalogue DISCOUNT method too', () => {
    // Even a DISCOUNT row with a fixed `value` (e.g. $3000) must not move
    // the total — catalogue DISCOUNT behaves exactly like NONE now.
    const fabrication_details = [
      { concept: 'LENGTH', detail: '', length: 1, width: 0, m2: 1, labor: 0, currency: 'ARS', quantity: 1, price: 10000 },
    ];
    const transferWithFixedDiscount = PAYMENT_METHODS.map((pm) =>
      pm.name === 'TRANSFERENCIA BANCARIA'
        ? { ...pm, type: 'DISCOUNT' as const, value: 3000, is_percentage: false }
        : pm
    );
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({
        fabrication_details,
        payment_method: 'TRANSFERENCIA BANCARIA',
        payment_method_id: 2,
        installments: 1,
      }),
      paymentMethods: transferWithFixedDiscount,
      overrides: {},
    });
    expect(data.catalogue_discount_percentage).toBe(0);
    expect(data.catalogue_discount_amount).toBe(0);
    expect(data.total).toBe(10000);
  });

  it('computes total_usd from sections instead of passthrough', () => {
    const fabrication_details = [
      { concept: 'CUTOUT_SINK', detail: '', length: 0, width: 0, m2: 0, labor: 0, currency: 'USD', quantity: 2, price: 55.25 },
    ];
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({
        fabrication_details,
        transport: 0,
        transport_usd: 0,
        discount_percentage: 0,
        payment_method: 'TARJETA DE CRÉDITO',
        payment_method_id: 4,
        installments: 3,
      }),
      paymentMethods: PAYMENT_METHODS,
      overrides: {},
    });
    // subtotal_usd = 110.50, recargo lineal (value=9, N=3):
    // ratio = 1.27 → total_usd = 110.50 × 1.27 = 140.34 (round2)
    expect(data.total_usd).toBe(140.34);
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

describe('buildPdfData — COMPARATIVA DE MEDICIÓN', () => {
  const baseParams = {
    document_type: 'work_order' as const,
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

  const measuredMaterials = [
    {
      id: 1,
      name: 'Negro Brasil',
      price_m2: 200000,
      price_m2_usd: 330,
      currency: 'USD',
      quantity: 2,
      m2_used: 0,
      m2_budgeted: 3, // quoted 3 m²
      length: 2, // 2 × 1.5 × 2 = 6 m² real
      width: 1.5,
      is_alternative: false,
    },
  ] satisfies MaterialInForm[];

  it('renders comparison rows for work orders when the flag is explicitly on', () => {
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({
        materials_data: measuredMaterials,
        status: 'MEASUREMENT',
        budget_id: 1,
        include_measurement_comparison_in_pdf: true,
      }),
      overrides: {},
    });
    expect(data.measurement_comparison).toHaveLength(1);
    const row = data.measurement_comparison[0];
    expect(row.concepto).toBe('Negro Brasil');
    expect(row.m2_real).toBe(6);
    expect(row.m2_budgeted).toBe(3);
    expect(row.delta).toBe(3);
    expect(row.delta_str).toContain('+');
    // Monetary DIFERENCIA subtotal of the m² delta (not the real m²): USD
    // material priced 330/m², delta 3 m² → 3 × 330 = 990 USD; usd_rate 1000
    // → 990.000 ARS. Positive → leading '+'.
    expect(row.subtotal_usd).toBe(990);
    expect(row.subtotal_ars).toBe(990000);
    expect(row.subtotal_usd_str).toBe('+990,00');
    expect(row.subtotal_ars_str).toBe('+990.000,00');
  });

  it('omits comparison rows for work orders when the flag is explicitly off', () => {
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({
        materials_data: measuredMaterials,
        status: 'MEASUREMENT',
        budget_id: 1,
        include_measurement_comparison_in_pdf: false,
      }),
      overrides: {},
    });
    expect(data.measurement_comparison).toEqual([]);
  });

  it('never renders comparison rows for budgets', () => {
    const data = buildPdfData({
      ...baseParams,
      document_type: 'budget',
      form: makeForm({ materials_data: measuredMaterials }),
      overrides: {},
    });
    expect(data.measurement_comparison).toEqual([]);
  });

  it('deduplicates a single catalogue frente assigned to multiple materials (billed in total ML)', () => {
    // Regression for the case in the screenshot: two NEGRO BRASIL mesadas +
    // ONE "Frente Ingletetado 45°" assigned to NEGRO BRASIL. The frente is
    // billed in TOTAL METROS LINEALES (not per mesada), so the comparison
    // must render it exactly ONCE, not twice.
    const twoMesadas = [
      {
        id: 1,
        name: 'NEGRO BRASIL',
        price_m2: 0,
        price_m2_usd: 330,
        currency: 'USD' as const,
        quantity: 1,
        m2_used: 0,
        m2_budgeted: 1.728,
        length: 2.75,
        width: 0.64,
        is_alternative: false,
      },
      {
        id: 2,
        name: 'NEGRO BRASIL',
        price_m2: 0,
        price_m2_usd: 330,
        currency: 'USD' as const,
        quantity: 1,
        m2_used: 0,
        m2_budgeted: 0.384,
        length: 0.68,
        width: 0.64,
        is_alternative: false,
      },
    ] satisfies MaterialInForm[];
    const additional_works_data = JSON.stringify([
      {
        additional_work_id: 88,
        name: 'Frente Ingletetado 45°',
        currency: 'USD',
        price: 49.33,
        quantity: 1,
        total: 169.20, // 49.33 × 3.43 ml (single item covering both mesadas)
        materialName: 'NEGRO BRASIL',
        type: 'frente',
        linear_meters: 3.43,
        linear_meters_budgeted: 3.3, // snapshot at budget creation
        total_ars_budgeted: 5068.0,
        total_usd_budgeted: 163.49,
      },
    ]);
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({
        materials_data: twoMesadas,
        additional_works_data,
        status: 'MEASUREMENT',
        budget_id: 999,
        include_measurement_comparison_in_pdf: true,
      }),
      overrides: {},
    });
    // 2 NEGRO BRASIL rows + exactly 1 frente detail row (deduped).
    expect(data.measurement_comparison).toHaveLength(3);
    const detailRows = data.measurement_comparison.filter((r) => r.is_detail);
    expect(detailRows).toHaveLength(1);
    expect(detailRows[0].concepto).toBe('Frente Ingletetado 45°');
    expect(detailRows[0].measure_real).toBe(3.43);
    expect(detailRows[0].measure_budgeted).toBe(3.3);
    expect(detailRows[0].measure_delta).toBeCloseTo(0.13);
    // Subtotal = real_total − budgeted_total in USD: 169.20 − 163.49 = 5.71.
    expect(detailRows[0].subtotal_usd).toBeCloseTo(5.71);
  });

  it('deduplicates a single zócalo fabrication row assigned to multiple same-name pieces', () => {
    // Regression for the reported bug: two NEGRO BRASIL mesadas + ONE zócalo
    // fabrication row assigned to NEGRO BRASIL. The zócalo must render
    // EXACTLY ONCE (under the first matching piece), not under every piece.
    const twoMesadas = [
      {
        id: 1,
        name: 'NEGRO BRASIL',
        price_m2: 0,
        price_m2_usd: 330,
        currency: 'USD' as const,
        quantity: 1,
        m2_used: 0,
        m2_budgeted: 1.728,
        length: 2.75,
        width: 0.64,
        is_alternative: false,
      },
      {
        id: 2,
        name: 'NEGRO BRASIL',
        price_m2: 0,
        price_m2_usd: 330,
        currency: 'USD' as const,
        quantity: 1,
        m2_used: 0,
        m2_budgeted: 0.384,
        length: 0.68,
        width: 0.64,
        is_alternative: false,
      },
    ] satisfies MaterialInForm[];
    const fabrication_details = [
      {
        concept: 'BASEBOARD',
        detail: 'Zócalo',
        length: 4,
        width: 0.105,
        quantity: 1,
        m2_budgeted: 0.34,
        price: 50,
        currency: 'USD',
        material: 'NEGRO BRASIL',
        total_usd_budgeted: 30,
        total_ars_budgeted: 30000,
      },
    ];
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({
        materials_data: twoMesadas,
        fabrication_details,
        status: 'MEASUREMENT',
        budget_id: 999,
        include_measurement_comparison_in_pdf: true,
      }),
      overrides: {},
    });
    // 2 NEGRO BRASIL rows + exactly 1 zócalo detail row (deduped).
    expect(data.measurement_comparison).toHaveLength(3);
    const detailRows = data.measurement_comparison.filter((r) => r.is_detail);
    expect(detailRows).toHaveLength(1);
    expect(detailRows[0].concepto).toBe('Zócalo NEGRO BRASIL');
    expect(detailRows[0].measure_unit).toBe('m2');
    expect(detailRows[0].measure_real).toBeCloseTo(0.42);
    expect(detailRows[0].measure_budgeted).toBe(0.34);
    expect(detailRows[0].measure_delta).toBeCloseTo(0.08);
    // Subtotal = real_total − budgeted_total in USD: 50 − 30 = 20.
    expect(detailRows[0].subtotal_usd).toBeCloseTo(20);
  });

  it('groups comparison rows contiguously by material, not input order', () => {
    // Pieces entered interleaved (CARAVELLAS WHITE, CARRARA, CARAVELLAS WHITE)
    // must render grouped: all CARAVELLAS WHITE rows together, zócalos
    // indented under their own piece, no interleaving.
    const interleaved = [
      {
        id: 1,
        name: 'CARAVELLAS WHITE',
        price_m2: 0,
        price_m2_usd: 330,
        currency: 'USD' as const,
        quantity: 1,
        m2_used: 0,
        m2_budgeted: 1.0,
        length: 1,
        width: 1,
        is_alternative: false,
      },
      {
        id: 2,
        name: 'CARRARA',
        price_m2: 0,
        price_m2_usd: 310,
        currency: 'USD' as const,
        quantity: 1,
        m2_used: 0,
        m2_budgeted: 1.0,
        length: 1.5,
        width: 1,
        is_alternative: false,
      },
      {
        id: 3,
        name: 'CARAVELLAS WHITE',
        price_m2: 0,
        price_m2_usd: 330,
        currency: 'USD' as const,
        quantity: 1,
        m2_used: 0,
        m2_budgeted: 1.0,
        length: 2,
        width: 1,
        is_alternative: false,
      },
    ] satisfies MaterialInForm[];
    const fabrication_details = [
      {
        concept: 'BASEBOARD',
        detail: 'Zócalo',
        length: 4,
        width: 0.105,
        quantity: 1,
        m2_budgeted: 0.34,
        price: 50,
        currency: 'USD',
        material: 'CARRARA',
      },
    ];
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({
        materials_data: interleaved,
        fabrication_details,
        status: 'MEASUREMENT',
        budget_id: 999,
        include_measurement_comparison_in_pdf: true,
      }),
      overrides: {},
    });
    const concepts = data.measurement_comparison.map((r) => r.concepto);
    // Material rows sorted by name (CARAVELLAS WHITE < CARRARA), both
    // CARAVELLAS WHITE pieces contiguous, zócalo indented under CARRARA.
    expect(concepts).toEqual([
      'CARAVELLAS WHITE',
      'CARAVELLAS WHITE',
      'CARRARA',
      'Zócalo CARRARA',
    ]);
    expect(data.measurement_comparison.filter((r) => r.is_detail)).toHaveLength(1);
  });

  it('keeps the comparison for direct work orders (no budget_id) — the toggle is always available', () => {
    // Business rule changed: the COMPARATIVA DE MEDICIÓN toggle is now
    // always visible/usable, including direct work orders. A direct order
    // has no "estimated" snapshot, so the Presupuestado column renders
    // "—", but the table is still built (real measures shown).
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({
        materials_data: measuredMaterials,
        status: 'MEASUREMENT',
        budget_id: null, // direct work order, no budget origin
        include_measurement_comparison_in_pdf: true, // opt-in, as in the form
      }),
      overrides: {},
    });
    expect(data.measurement_comparison).toHaveLength(1);
  });

  it('hides the comparison for direct work orders when the explicit flag is off', () => {
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({
        materials_data: measuredMaterials,
        status: 'MEASUREMENT',
        budget_id: null, // direct work order, no budget origin
        include_measurement_comparison_in_pdf: false,
      }),
      overrides: {},
    });
    expect(data.measurement_comparison).toEqual([]);
  });

  it('keeps the comparison when budget_id is present (work order converted from budget)', () => {
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({
        materials_data: measuredMaterials,
        status: 'MEASUREMENT',
        budget_id: 42, // converted from budget
        include_measurement_comparison_in_pdf: true,
      }),
      overrides: {},
    });
    expect(data.measurement_comparison).toHaveLength(1);
  });

  it('shows a positive ARS subtotal even when measured below budget', () => {
    const lessMaterial = [
      {
        id: 2,
        name: 'Granito Gris',
        price_m2: 180000,
        price_m2_usd: 300,
        currency: 'ARS',
        quantity: 1,
        m2_used: 0,
        m2_budgeted: 4, // quoted 4 m²
        length: 2, // 2 × 1 × 1 = 2 m² real
        width: 1,
        is_alternative: false,
      },
    ] satisfies MaterialInForm[];
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({
        materials_data: lessMaterial,
        status: 'MEASUREMENT',
        budget_id: 1,
        include_measurement_comparison_in_pdf: true,
      }),
      overrides: {},
    });
    const row = data.measurement_comparison[0];
    expect(row.delta).toBe(-2);
    // Monetary DIFERENCIA subtotal of the m² delta: ARS-native 2 m² below
    // budget × 180.000/m² = −360.000 ARS; /1000 → −360 USD. Negative → '−'.
    expect(row.subtotal_ars).toBe(-360000);
    expect(row.subtotal_usd).toBe(-360);
    expect(row.subtotal_ars_str).toBe('-360.000,00');
    expect(row.subtotal_usd_str).toBe('-360,00');
  });

  it('emits linked zócalo/frente as indented detail rows under the material and sums the TOTAL row', () => {
    // Material: USD 330/m², budgeted 3 m², real 6 m² → delta +3 m² → +990 USD.
    // Linked zócalo (fabrication): price 50 USD, budgeted 30 USD → +20 USD.
    // Linked frente (additional_works): total 100 USD, budgeted 80 USD → +20 USD.
    // Row 0 = material's OWN m² delta only (+990 USD). Rows 1-2 = detail rows
    // with their own delta (+20 + +20 USD). TOTAL = 990 + 20 + 20 = 1030 USD.
    const fabrication_details = [
      {
        concept: 'BASEBOARD',
        detail: 'Zócalo',
        length: 4,
        width: 0.105,
        quantity: 1,
        m2_budgeted: 0.34,
        price: 50,
        currency: 'USD',
        material: 'Negro Brasil',
        total_usd_budgeted: 30,
        total_ars_budgeted: 30000,
      },
    ];
    const adicionales = JSON.stringify([
      {
        name: 'Frente Ingletetado 45°',
        type: 'frente',
        price: 100,
        quantity: 1,
        total: 100,
        currency: 'USD',
        materialName: 'Negro Brasil',
        linear_meters: 3,
        linear_meters_budgeted: 3,
        total_usd_budgeted: 80,
        total_ars_budgeted: 80000,
      },
    ]);
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({
        materials_data: measuredMaterials,
        fabrication_details,
        additional_works_data: adicionales,
        status: 'MEASUREMENT',
        budget_id: 1,
        include_measurement_comparison_in_pdf: true,
      }),
      overrides: {},
    });
    expect(data.measurement_comparison).toHaveLength(3);

    // Row 0 — the material itself: subtotal is ONLY its m² delta (+990 USD),
    // the zócalo/frente deltas are NOT folded in.
    const materialRow = data.measurement_comparison[0];
    expect(materialRow.concepto).toBe('Negro Brasil');
    expect(materialRow.is_detail).toBeFalsy();
    expect(materialRow.subtotal_usd).toBe(990);
    expect(materialRow.subtotal_ars).toBe(990000);
    expect(materialRow.subtotal_usd_str).toBe('+990,00');
    expect(materialRow.subtotal_ars_str).toBe('+990.000,00');

    // Row 1 — linked zócalo as an indented detail row (fabrication source).
    const zocalo = data.measurement_comparison[1];
    expect(zocalo.is_detail).toBe(true);
    expect(zocalo.concepto).toBe('Zócalo Negro Brasil');
    expect(zocalo.subtotal_usd).toBe(20);
    expect(zocalo.subtotal_ars).toBe(20000);
    expect(zocalo.subtotal_usd_str).toBe('+20,00');
    expect(zocalo.subtotal_ars_str).toBe('+20.000,00');
    // Measure columns (m²): real 4 × 0.105 × 1 = 0,42 m², budgeted snapshot
    // 0,34 m² → Diferencia +0,08 m².
    expect(zocalo.measure_unit).toBe('m2');
    expect(zocalo.measure_budgeted_str).toBe('0,34 m²');
    expect(zocalo.measure_real_str).toBe('0,42 m²');
    expect(zocalo.measure_delta_str).toBe('+0,08 m²');

    // Row 2 — linked frente as an indented detail row (catalogue source).
    const frente = data.measurement_comparison[2];
    expect(frente.is_detail).toBe(true);
    expect(frente.concepto).toBe('Frente Ingletetado 45°');
    expect(frente.subtotal_usd).toBe(20);
    expect(frente.subtotal_ars).toBe(20000);
    expect(frente.subtotal_usd_str).toBe('+20,00');
    expect(frente.subtotal_ars_str).toBe('+20.000,00');
    // Measure columns (ml): real 3 / budgeted 3 → Diferencia 0 ml.
    expect(frente.measure_unit).toBe('ml');
    expect(frente.measure_budgeted_str).toBe('3 ml');
    expect(frente.measure_real_str).toBe('3 ml');
    expect(frente.measure_delta_str).toBe('0 ml');

    // TOTAL row = sum over all comparison rows (material + details).
    const totalUsd = data.measurement_comparison.reduce((s, r) => s + r.subtotal_usd, 0);
    const totalArs = data.measurement_comparison.reduce((s, r) => s + r.subtotal_ars, 0);
    expect(totalUsd).toBe(1030);
    expect(totalArs).toBe(1030000);
  });

  it('values a price-0 zócalo at the linked material price/m² so the m² drift shows in the money columns', () => {
    // Real-world case: the zócalo strip is billed through the base material's
    // m² (`price: 0` on the fabrication row). With only the price × qty formula
    // the monetary delta would always be $0; the +0,08 m² real-vs-budgeted
    // drift must instead be valued at the linked material's price_m2
    // (Negro Brasil, USD 330/m²) → +26,40 USD / +26.400 ARS (rate 1000).
    const fabrication_details = [
      {
        concept: 'BASEBOARD',
        detail: 'Zócalo',
        length: 4, // real 4 × 0,105 × 1 = 0,42 m²
        width: 0.105,
        quantity: 1,
        m2_budgeted: 0.34, // snapshot → delta +0,08 m²
        price: 0,
        currency: 'USD',
        material: 'Negro Brasil',
      },
    ];
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({
        materials_data: measuredMaterials,
        fabrication_details,
        status: 'MEASUREMENT',
        budget_id: 1,
        include_measurement_comparison_in_pdf: true,
      }),
      overrides: {},
    });
    expect(data.measurement_comparison).toHaveLength(2);

    // Row 0 — the material: unchanged (+990 USD, its own m² delta only).
    expect(data.measurement_comparison[0].subtotal_usd).toBe(990);

    // Row 1 — the zócalo (price 0): measure delta +0,08 m² valued at 330 USD/m².
    const zocalo = data.measurement_comparison[1];
    expect(zocalo.is_detail).toBe(true);
    expect(zocalo.concepto).toBe('Zócalo Negro Brasil');
    expect(zocalo.measure_unit).toBe('m2');
    expect(zocalo.measure_budgeted_str).toBe('0,34 m²');
    expect(zocalo.measure_real_str).toBe('0,42 m²');
    expect(zocalo.measure_delta_str).toBe('+0,08 m²');
    expect(zocalo.subtotal_usd).toBeCloseTo(26.4, 5);
    expect(zocalo.subtotal_ars).toBeCloseTo(26400, 5);
    expect(zocalo.subtotal_usd_str).toBe('+26,40');
    expect(zocalo.subtotal_ars_str).toBe('+26.400,00');
  });

  it('always emits linked detail rows even when the delta is zero (no snapshot / unchanged)', () => {
    // Real-world case (A-000003): a frente assigned to a material but with no
    // `total_*_budgeted` snapshot → delta 0. It must STILL appear as a detail
    // row (with +0,00) so the client sees the full composition.
    const fabrication_details = [
      {
        concept: 'BASEBOARD',
        detail: '',
        material: 'Negro Brasil',
        material_price_m2: 330,
        length: 4,
        width: 0.105,
        m2: 0.42,
        quantity: 1,
        currency: 'USD',
        price: 50,
        total_ars_budgeted: 50000,
        total_usd_budgeted: 50,
      },
    ];
    const adicionales = JSON.stringify([
      {
        name: 'Frente Ingletetado 45°',
        detail: 'Frente 45°',
        type: 'frente',
        price: 52.33,
        quantity: 1,
        total: 156.98,
        currency: 'USD',
        materialName: 'Negro Brasil',
        assigned_material_id: 1,
        linear_meters: 3,
      },
    ]);
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({
        materials_data: measuredMaterials,
        fabrication_details,
        additional_works_data: adicionales,
        status: 'MEASUREMENT',
        budget_id: 1,
        include_measurement_comparison_in_pdf: true,
      }),
      overrides: {},
    });
    // Row 0 = material (its OWN m² delta +990 USD).
    // Row 1 = zócalo (delta 0, snapshot equals current) still shown.
    // Row 2 = frente (delta 0, no snapshot) still shown.
    expect(data.measurement_comparison).toHaveLength(3);

    const zocalo = data.measurement_comparison[1];
    expect(zocalo.is_detail).toBe(true);
    expect(zocalo.concepto).toBe('Zócalo Negro Brasil');
    expect(zocalo.subtotal_usd).toBe(0);
    expect(zocalo.subtotal_ars_str).toBe('0,00');
    // Legacy row without a dimensional snapshot: real measure shown, budgeted
    // and delta '—' (empty string → rendered as '—').
    expect(zocalo.measure_unit).toBe('m2');
    expect(zocalo.measure_real_str).toBe('0,42 m²');
    expect(zocalo.measure_budgeted_str).toBe('');
    expect(zocalo.measure_delta_str).toBe('');

    const frente = data.measurement_comparison[2];
    expect(frente.is_detail).toBe(true);
    expect(frente.concepto).toBe('Frente Ingletetado 45°');
    expect(frente.subtotal_usd).toBe(0);
    expect(frente.subtotal_usd_str).toBe('0,00');
    expect(frente.subtotal_ars_str).toBe('0,00');
    expect(frente.measure_unit).toBe('ml');
    expect(frente.measure_real_str).toBe('3 ml');
    expect(frente.measure_budgeted_str).toBe('');
    expect(frente.measure_delta_str).toBe('');
  });

  it('orphan material row (no m2_budgeted snapshot) does NOT inflate the comparison TOTAL', () => {
    // Regression sentinel: a material row whose `m2_budgeted=0`
    // (no snapshot — legacy or re-frozen post-conversion) used to set its
    // `subtotal_ars` to `delta × price × rate` with `delta = m2_real`
    // `subtotal_ars` to `delta × price × rate` with `delta = m2_real`
    // (i.e. the FULL material price) so the comparison table TOTAL
    // summed the entire material price even though the row's
    // Subtotal cell rendered as '—'. WO5 reproduced this: BLANCO
    // SUGGAR × 1,395 m² × USD 335/m² × 1535 ARS/USD = $717.343,88
    // showed up in the TOTAL row even though the row said "—".
    // The fix zeroes out orphan material rows so the TOTAL only
    // counts rows with a real delta (real − budgeted).
    const fabrication_details = [
      {
        concept: 'BASEBOARD',
        detail: '',
        material: 'BLANCO SUGGAR',
        material_price_m2: 335,
        length: 2.25,
        width: 0.15,
        m2: 0.3375,
        quantity: 1,
        currency: 'USD',
        price: 113.06,
      },
    ];
    const adicionales = JSON.stringify([
      {
        name: 'Traforo de Pileta',
        type: 'flat',
        price: 60000,
        currency: 'ARS',
        quantity: 1,
        total: 60000,
        materialName: '__GLOBAL__',
      },
    ]);
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({
        fabrication_details,
        additional_works_data: adicionales,
        // material is BLANCO SUGGAR USD 335/m² × 2.25×0.62 m² with NO
        // `m2_budgeted` snapshot — exactly the orphan case.
        materials_data: [
          {
            id: 21,
            name: 'BLANCO SUGGAR',
            category: '3',
            color: 'Blanco',
            price_m2: 335000,
            price_m2_usd: 335,
            currency: 'USD',
            quantity: 1,
            m2_used: 0,
            // no m2_budgeted → orphan
            length: 2.25,
            width: 0.62,
            is_alternative: false,
          },
        ],
        status: 'MEASUREMENT',
        budget_id: 1,
        include_measurement_comparison_in_pdf: true,
      }),
      overrides: {},
    });
    // Orphan material row: Subtotal cell stays '—' (empty) and the
    // raw value must be ZERO so the comparison TOTAL doesn't include it.
    const materialRow = data.measurement_comparison.find((r) => !r.is_detail);
    expect(materialRow).toBeDefined();
    expect(materialRow!.subtotal_ars).toBe(0);
    expect(materialRow!.subtotal_usd).toBe(0);
    expect(materialRow!.subtotal_ars_str).toBe('');
    // TOTAL = sum of all rows' subtotal_ars must be 0 (only detail
    // rows contribute, and they have delta 0).
    const totalArs = data.measurement_comparison.reduce((s, r) => s + r.subtotal_ars, 0);
    const totalUsd = data.measurement_comparison.reduce((s, r) => s + r.subtotal_usd, 0);
    expect(totalArs).toBe(0);
    expect(totalUsd).toBe(0);
  });

  it('exposes the active payment-methods catalogue for the PDF reference box', () => {
    // The "METODO DE PAGO" box in the PDF must consume the catalogue from
    // /admin/configuration/payment-methods: active rows only, uppercase
    // `name`s ordered by `sort_order` (the same convention as the "Forma
    // de pago:" row).
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({ payment_method: 'EFECTIVO', payment_method_id: 1, installments: 1 }),
      paymentMethods: PAYMENT_METHODS,
      overrides: {},
    });
    expect(data.payment_methods_catalogue).toEqual([
      'EFECTIVO',
      'TRANSFERENCIA BANCARIA',
      'TARJETA DE DÉBITO',
      'TARJETA DE CRÉDITO - 9% P/ CUOTA',
    ]);
  });

  it('excludes inactive payment methods from the catalogue reference box', () => {
    const withHidden = PAYMENT_METHODS.map((p, i) =>
      i === 2 ? { ...p, is_active: false } : p,
    );
    const data = buildPdfData({
      ...baseParams,
      form: makeForm({ payment_method: 'EFECTIVO', payment_method_id: 1, installments: 1 }),
      paymentMethods: withHidden,
      overrides: {},
    });
    expect(data.payment_methods_catalogue).toEqual([
      'EFECTIVO',
      'TRANSFERENCIA BANCARIA',
      'TARJETA DE CRÉDITO - 9% P/ CUOTA',
    ]);
  });
});
