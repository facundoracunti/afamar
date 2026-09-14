import { describe, it, expect } from 'vitest';
import { buildWorkshopPdfData } from './buildWorkshopPdfData';
import type { CompanyInfo } from './pdfTypes';

const company: CompanyInfo = {
  company_name: 'AFAMAR',
  company_tagline: 'Piletas & Silestone',
  company_address: 'Av. Constituyentes 1234',
  company_phone: '+54 11 4444-5555',
  company_email: 'info@afamar.com.ar',
  company_logo: '',
  pdf_footer: '',
};

const minimalForm: Record<string, unknown> = {
  number: 'A-000001',
  date: '2026-09-10',
  client_name: 'Juan Pérez',
  material: 'NEGRO BRASIL',
  materials_data: null,
  pools_data: null,
  design_observations: 'Zócalo de 10 cm',
};

describe('buildWorkshopPdfData', () => {
  it('builds a complete WorkshopPdfData from a populated form', () => {
    const result = buildWorkshopPdfData({
      form: minimalForm,
      company,
      sketchImages: ['data:image/png;base64,abc123'],
    });

    expect(result.document_type).toBe('workshop_sheet');
    expect(result.company).toBe(company);
    expect(result.number).toBe('A-000001');
    expect(result.client_name).toBe('Juan Pérez');
    expect(result.materials).toEqual(['NEGRO BRASIL']);
    expect(result.pools).toEqual([]);
    expect(result.design_observations).toBe('Zócalo de 10 cm');
    expect(result.sketch_pages).toEqual([
      { name: 'Página 1', material: '', image: 'data:image/png;base64,abc123' },
    ]);
    expect(result.specs).toHaveLength(6);
  });

  it('labels each sketch page with its name + material for the taller sheet', () => {
    const result = buildWorkshopPdfData({
      form: {
        ...minimalForm,
        sketch_elements: [
          { pagina_id: 1, name: 'Cocina principal', material: 'BLANCO SUGGAR', dibujo: [] },
          { pagina_id: 2, name: 'Baño chico', material: 'ROSA DE SALTO', dibujo: [] },
        ],
      },
      company,
      sketchImages: ['img1', 'img2'],
    });

    expect(result.sketch_pages).toEqual([
      { name: 'Cocina principal', material: 'BLANCO SUGGAR', image: 'img1' },
      { name: 'Baño chico', material: 'ROSA DE SALTO', image: 'img2' },
    ]);
  });

  it('falls back to generic page names when sketch_elements metadata is missing', () => {
    const result = buildWorkshopPdfData({
      form: minimalForm,
      company,
      sketchImages: ['img1', 'img2'],
    });

    expect(result.sketch_pages).toEqual([
      { name: 'Página 1', material: '', image: 'img1' },
      { name: 'Página 2', material: '', image: 'img2' },
    ]);
  });

  it('renders the 6 spec cells with labels — ALWAYS blank (workers fill by hand)', () => {
    const result = buildWorkshopPdfData({
      form: minimalForm,
      company,
      sketchImages: [],
    });

    expect(result.specs.map((spec) => spec.label)).toEqual([
      'Corte', 'Faja', 'Perf.', 'Tras. / Peg.', 'Term.', 'Sopapas',
    ]);
    // The grid prints BLANK regardless of what the form contains:
    // the shop-floor workers complete the cells with pen on paper.
    expect(result.specs.every((spec) => spec.value === '')).toBe(true);
  });

  it('keeps the spec grid blank even when the form carries values', () => {
    const result = buildWorkshopPdfData({
      form: {
        ...minimalForm,
        workshop_corte: '45°',
        workshop_faja: '3 cm',
        workshop_term: 'Lija 120',
      },
      company,
      sketchImages: [],
    });
    expect(result.specs.every((spec) => spec.value === '')).toBe(true);
  });

  it('resolves ALL material names from materials_data when form.material is empty', () => {
    const form = {
      ...minimalForm,
      material: '',
      materials_data: JSON.stringify([
        { name: 'GRIS PERLA', price: 180000 },
        { name: 'GRIS CITY', price: 335 },
      ]),
    };
    const result = buildWorkshopPdfData({ form, company, sketchImages: [] });
    expect(result.materials).toEqual(['GRIS PERLA', 'GRIS CITY']);
  });

  it('resolves material names from an already-parsed materials_data array (mapApiToForm shape)', () => {
    // mapApiToForm leaves materials_data as a parsed array, not a JSON string.
    const form = {
      ...minimalForm,
      material: '',
      materials_data: [
        { name: 'BLANCO SUGGAR', price_m2: 335, quantity: 1 },
      ] as unknown as string,
    };
    const result = buildWorkshopPdfData({ form, company, sketchImages: [] });
    expect(result.materials).toEqual(['BLANCO SUGGAR']);
  });

  it('excludes alternative material options — the taller only cuts the main ones', () => {
    const form = {
      ...minimalForm,
      material: '',
      materials_data: JSON.stringify([
        { name: 'GRIS PERLA', is_alternative: false },
        { name: 'GRIS CITY', is_alternative: false },
        { name: 'ZIRCONIUM', is_alternative: true },
        { name: 'GRIS MARA', is_alternative: true },
      ]),
    };
    const result = buildWorkshopPdfData({ form, company, sketchImages: [] });
    expect(result.materials).toEqual(['GRIS PERLA', 'GRIS CITY']);
  });

  it('dedupes repeated material names across rows', () => {
    const form = {
      ...minimalForm,
      material: '',
      materials_data: JSON.stringify([
        { name: 'NEGRO BRASIL', is_alternative: false },
        { name: 'NEGRO BRASIL', is_alternative: false },
      ]),
    };
    const result = buildWorkshopPdfData({ form, company, sketchImages: [] });
    expect(result.materials).toEqual(['NEGRO BRASIL']);
  });

  it('resolves ALL pool labels from pools_data brand + model', () => {
    const form = {
      ...minimalForm,
      pools_data: JSON.stringify([
        { brand: 'JOHNSON', model: 'C 28/18', price: 936000 },
        { brand: 'JOHNSON', model: 'G 50', price: 900000 },
        { brand: 'JOHNSON', model: 'LUXOR MINI SI55A', price: 980000 },
      ]),
    };
    const result = buildWorkshopPdfData({ form, company, sketchImages: [] });
    expect(result.pools).toEqual([
      { label: 'JOHNSON C 28/18', material: '', display: '' },
      { label: 'JOHNSON G 50', material: '', display: '' },
      { label: 'JOHNSON LUXOR MINI SI55A', material: '', display: '' },
    ]);
  });

  it('carries each pool to its assigned mesada (PoolInForm.material)', () => {
    const form = {
      ...minimalForm,
      pools_data: JSON.stringify([
        { brand: 'JOHNSON', model: 'C 28/18', material: 'GRIS PERLA' },
        { brand: 'JOHNSON', model: 'G 50', material: 'GRIS CITY' },
        { brand: 'JOHNSON', model: 'LUXOR MINI SI55A', material: 'GRIS CITY' },
      ]),
    };
    const result = buildWorkshopPdfData({ form, company, sketchImages: [] });
    expect(result.pools).toEqual([
      { label: 'JOHNSON C 28/18', material: 'GRIS PERLA', display: 'GRIS PERLA' },
      { label: 'JOHNSON G 50', material: 'GRIS CITY', display: 'GRIS CITY' },
      { label: 'JOHNSON LUXOR MINI SI55A', material: 'GRIS CITY', display: 'GRIS CITY' },
    ]);
  });

  it('renders pool->mesada with dimensions when the pool carries mesada_* fields', () => {
    const form = {
      ...minimalForm,
      pools_data: JSON.stringify([
        { brand: 'JOHNSON', model: 'C 28/18', material: 'GRIS PERLA', mesada_length: 1.85, mesada_width: 0.58 },
        { brand: 'JOHNSON', model: 'G 50', material: 'GRIS PERLA', mesada_length: 2.1, mesada_width: 0.64 },
        { brand: 'JOHNSON', model: 'LUXOR MINI SI55A', material: 'GRIS CITY', mesada_length: 2.8, mesada_width: 0.6 },
      ]),
    };
    const result = buildWorkshopPdfData({ form, company, sketchImages: [] });
    expect(result.pools).toEqual([
      { label: 'JOHNSON C 28/18', material: 'GRIS PERLA', display: '1.85 X 0.58 GRIS PERLA' },
      { label: 'JOHNSON G 50', material: 'GRIS PERLA', display: '2.10 X 0.64 GRIS PERLA' },
      { label: 'JOHNSON LUXOR MINI SI55A', material: 'GRIS CITY', display: '2.80 X 0.60 GRIS CITY' },
    ]);
  });

  it('falls back to materials_data dimensions when the pool only links by name', () => {
    const form = {
      ...minimalForm,
      materials_data: JSON.stringify([
        { name: 'GRIS PERLA', length: 1.85, width: 0.58, is_alternative: false },
        { name: 'GRIS CITY', length: 2.8, width: 0.6, is_alternative: false },
      ]),
      pools_data: JSON.stringify([
        { brand: 'JOHNSON', model: 'C 28/18', material: 'GRIS PERLA' },
        { brand: 'JOHNSON', model: 'LUXOR MINI SI55A', material: 'GRIS CITY' },
      ]),
    };
    const result = buildWorkshopPdfData({ form, company, sketchImages: [] });
    expect(result.pools).toEqual([
      { label: 'JOHNSON C 28/18', material: 'GRIS PERLA', display: '1.85 X 0.58 GRIS PERLA' },
      { label: 'JOHNSON LUXOR MINI SI55A', material: 'GRIS CITY', display: '2.80 X 0.60 GRIS CITY' },
    ]);
  });

  it('joins multiple matching mesadas with " / " for a name-only link', () => {
    const form = {
      ...minimalForm,
      materials_data: JSON.stringify([
        { name: 'GRIS PERLA', length: 1.85, width: 0.58, is_alternative: false },
        { name: 'GRIS PERLA', length: 2.1, width: 0.64, is_alternative: false },
      ]),
      pools_data: JSON.stringify([
        { brand: 'JOHNSON', model: 'C 28/18', material: 'GRIS PERLA' },
      ]),
    };
    const result = buildWorkshopPdfData({ form, company, sketchImages: [] });
    expect(result.pools).toEqual([
      { label: 'JOHNSON C 28/18', material: 'GRIS PERLA', display: '1.85 X 0.58 / 2.10 X 0.64 GRIS PERLA' },
    ]);
  });

  it('keeps POOL_MATERIAL_GLOBAL pools unassigned-specific on the taller sheet', () => {
    const form = {
      ...minimalForm,
      pools_data: JSON.stringify([
        { brand: 'JOHNSON', model: 'AXIS E', material: 'GRIS PERLA' },
        { brand: 'JOHNSON', model: 'G 50', material: '__GLOBAL__' },
      ]),
    };
    const result = buildWorkshopPdfData({ form, company, sketchImages: [] });
    expect(result.pools[1]).toEqual({ label: 'JOHNSON G 50', material: '__GLOBAL__', display: '__GLOBAL__' });
  });

  it('resolves pools from an already-parsed pools_data array', () => {
    const form = {
      ...minimalForm,
      pools_data: [{ brand: 'JOHNSON', model: 'AXIS 55' }] as unknown as string,
    };
    const result = buildWorkshopPdfData({ form, company, sketchImages: [] });
    expect(result.pools).toEqual([{ label: 'JOHNSON AXIS 55', material: '', display: '' }]);
  });

  it('falls back to work_order_number when number is missing', () => {
    const form = { ...minimalForm, number: '', work_order_number: 'A-000007' };
    const result = buildWorkshopPdfData({ form, company, sketchImages: [] });
    expect(result.number).toBe('A-000007');
  });

  it('uses defaultNumber when both number and work_order_number are missing', () => {
    const form = { ...minimalForm, number: '', work_order_number: '' };
    const result = buildWorkshopPdfData({
      form,
      company,
      sketchImages: [],
      defaultNumber: 'A-000099',
    });
    expect(result.number).toBe('A-000099');
  });
});
