/**
 * Build the data payload that the <DocumentPdf/> render expects.
 *
 * This is a TypeScript / frontend port of the Python helpers
 * `app/services/pdf_html.py::build_budget_pdf_data` and
 * `build_work_order_pdf_data` from the afamar-backend. The output shape
 * matches the props documented by `<DocumentPdf/>` in
 * `components/ui/PdfPreviewModal/DocumentPdf.tsx`.
 *
 * The frontend takes ownership of rendering PDFs in the browser today,
 * so these helpers replaced the backend Jinja2 + xhtml2pdf pipeline.
 */

import type { MaterialInForm, PoolInForm, FabricationDetail } from '../../types/budget';

export type DocumentType = 'budget' | 'work_order';

export interface PdfDataRow {
  readonly concept: string;
  readonly detail: string;
  readonly material: string;
  readonly show_length: boolean;
  readonly show_width: boolean;
  readonly show_m2: boolean;
  readonly show_quantity: boolean;
  readonly length_str: string | null;
  readonly width_str: string | null;
  readonly m2_label: string | null;
  readonly quantity: number;
  readonly currency: 'ARS' | 'USD';
  readonly price_str: string;
  readonly subtotal_ars: number;
  readonly subtotal_usd: number;
}

export interface MaterialPdfRow {
  readonly name: string;
  readonly color: string;
  readonly length_str: string;
  readonly width_str: string;
  readonly quantity: number;
  readonly m2_str: string;
  readonly price_m2_str: string;
  readonly subtotal_str: string;
  readonly currency: 'ARS' | 'USD';
  readonly subtotal_ars: number;
  readonly subtotal_usd: number;
}

export interface PoolPdfRow {
  readonly brand: string;
  readonly model: string;
  readonly quantity: number;
  readonly price_str: string;
  readonly subtotal_str: string;
  readonly currency: 'ARS' | 'USD';
  readonly subtotal_ars: number;
  readonly subtotal_usd: number;
}

export interface CompanyInfo {
  company_name: string;
  company_tagline: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_logo: string;
  pdf_footer: string;
}

export interface TermsInfo {
  budget_terms: string[];
  delivery_terms: string[];
  warranty_text: string[];
}

export interface PdfDocumentData {
  document_type: DocumentType;
  title: string;
  number: string;
  doc_sub: string;
  date: string;
  client_name: string;
  client_phone: string;
  client_address: string;
  client_email: string;
  material_color: string;
  material_thickness: string;
  material_finish: string;
  delivery_date: string;
  fabrication_details: PdfDataRow[];
  materials: MaterialPdfRow[];
  pools: PoolPdfRow[];
  subtotal: number;
  transport: number;
  discount_percentage: number;
  discount_fixed_amount: number;
  deposit_received: number;
  balance_due: number;
  total: number;
  total_usd: number;
  payment_method: string;
  installments: number;
  notes: string;
  important_observations: string;
  important_observations_list: string[];
  budget_terms_list: string[];
  delivery_terms_list: string[];
  warranty_terms_list: string[];
  sketch_images: string[];
  company: CompanyInfo;
}

const CONCEPT_DISPLAY: Record<string, string> = {
  BASEBOARD: 'Zócalo',
  FRONT: 'Frente',
  LENGTH: 'Longitud',
  ZOCALOS: 'Zócalos',
  CUTOUT_SINK: 'Traforo de Pileta',
  CUTOUT_COOKTOP: 'Traforo de Anafe',
  CUTOUT_DROPIN_SINK: 'Traforo de Pileta de Apoyo',
  'PILETA MOD': 'Pileta Mod.',
  TERMINACION: 'Terminación',
  OTHER: 'Otro',
};

const STATUS_SUB_MAP: Record<string, string> = {
  PENDING: 'Pendiente',
  ONLINE: 'Online',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  CONVERTED_TO_OT: 'Convertido a OT',
  MEASUREMENT: 'Medición',
  WORKSHOP: 'En Taller',
  FINISHED: 'Finalizado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};

const M2_CONCEPTS = new Set(['LENGTH', 'BASEBOARD', 'FRONT', 'LARGO', 'ZOCALOS', 'FRENTE']);
const UNIT_CONCEPTS = new Set([
  'CUTOUT_SINK',
  'CUTOUT_COOKTOP',
  'CUTOUT_DROPIN_SINK',
  'PILETA MOD',
  'TRAFORO_PILETA',
  'TRAFORO_ANAFE',
  'TRAFORO_PILETA_APOYO',
]);
const LINEAR_CONCEPTS = new Set(['TERMINACION']);

function formatDate(d: unknown): string {
  if (!d) return new Date().toLocaleDateString('es-AR');
  const s = String(d);
  try {
    return new Date(s.slice(0, 10)).toLocaleDateString('es-AR');
  } catch {
    return s;
  }
}

function fmtNum(value: unknown, decimals = 2): string {
  let n: number;
  if (typeof value === 'number') n = value;
  else if (value == null || value === '') n = 0;
  else n = Number(value);
  if (!Number.isFinite(n)) n = 0;
  return n.toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtMoney(value: unknown): string {
  return fmtNum(value, 2);
}

function fmtUnit(value: unknown, decimals = 2, suffix = ''): string {
  return `${fmtNum(value, decimals)} ${suffix}`.trim();
}

function conceptToDisplay(conceptCode: string, custom = ''): string {
  if (conceptCode === 'OTHER' && custom) return custom;
  return CONCEPT_DISPLAY[conceptCode] || conceptCode || '—';
}

function parseJsonList(raw: unknown): unknown[] {
  if (raw === null || raw === undefined || raw === '') return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return raw
        .split(/[;\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function splitTerms(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((t) => String(t).trim()).filter(Boolean);
  if (value == null) return [];
  const text = String(value).trim();
  if (!text) return [];
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map((t) => String(t).trim()).filter(Boolean);
    } catch {
      /* fallthrough to legacy mode */
    }
  }
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildFabricationRows(raw: unknown, usdRate: number): PdfDataRow[] {
  const items = parseJsonList(raw) as FabricationDetail[];
  if (!items || items.length === 0) return [];
  const result: PdfDataRow[] = [];
  for (const d of items) {
    const conceptCode = (d.concept || '').toUpperCase();
    const custom = (d.custom_concept || '').trim();
    const length = Number(d.length || 0);
    const width = Number(d.width || 0);
    const quantity = Number(d.quantity || 1);
    const price = Number(d.price || 0);
    const currency: 'ARS' | 'USD' = d.currency === 'USD' ? 'USD' : 'ARS';

    const isM2 = M2_CONCEPTS.has(conceptCode);
    const isUnit = UNIT_CONCEPTS.has(conceptCode);
    const isLinear = LINEAR_CONCEPTS.has(conceptCode);
    const showLength = isM2 || isLinear || length > 0;
    const showWidth = isM2 || width > 0;
    const showM2 = isM2;
    const showQuantity = isM2 || isUnit || quantity > 0;
    const m2Value = isM2 ? Math.round(length * width * quantity * 10000) / 10000 : null;

    const lineTotal = price * quantity;
    const subtotalArs = currency === 'ARS' ? lineTotal : usdRate > 0 ? lineTotal * usdRate : 0;
    const subtotalUsd = currency === 'USD' ? lineTotal : usdRate > 0 ? lineTotal / usdRate : 0;

    result.push({
      concept: conceptToDisplay(conceptCode, custom),
      detail: d.detail || '',
      material: d.material || '',
      show_length: showLength,
      show_width: showWidth,
      show_m2: showM2,
      show_quantity: showQuantity,
      length_str: showLength && length ? fmtUnit(length, 2, 'm') : null,
      width_str: showWidth && width ? fmtUnit(width, 2, 'm') : null,
      m2_label: isUnit ? 'U' : isM2 ? fmtNum(m2Value) : null,
      quantity: Number.isInteger(quantity) ? quantity : quantity,
      currency,
      price_str: fmtMoney(price),
      subtotal_ars: subtotalArs,
      subtotal_usd: subtotalUsd,
    });
  }
  return result;
}

function buildMaterialRows(materials: MaterialInForm[], usdRate: number): MaterialPdfRow[] {
  const result: MaterialPdfRow[] = [];
  for (const src of materials) {
    const length = Number(src.length || 0);
    const width = Number(src.width || 0);
    const quantity = Number(src.quantity || 1);
    const m2 = length * width * quantity;
    const currency: 'ARS' | 'USD' = src.currency === 'USD' ? 'USD' : 'ARS';
    const priceM2Ars = Number(src.price_m2 || 0);
    const priceM2Usd = Number(src.price_m2_usd || 0);
    const subtotalOriginal = currency === 'USD'
      ? m2 * priceM2Usd
      : m2 * priceM2Ars;
    const subtotalArs = currency === 'ARS' ? subtotalOriginal : usdRate > 0 ? subtotalOriginal * usdRate : 0;
    const subtotalUsd = currency === 'USD' ? subtotalOriginal : usdRate > 0 ? subtotalOriginal / usdRate : 0;
    const priceM2 = currency === 'USD' ? priceM2Usd : priceM2Ars;
    result.push({
      name: src.name || '',
      color: src.color || '',
      length_str: fmtUnit(length, 2, 'm'),
      width_str: fmtUnit(width, 2, 'm'),
      quantity: Number.isInteger(quantity) ? quantity : quantity,
      m2_str: fmtNum(m2),
      price_m2_str: fmtMoney(priceM2),
      subtotal_str: fmtMoney(subtotalOriginal),
      currency,
      subtotal_ars: subtotalArs,
      subtotal_usd: subtotalUsd,
    });
  }
  return result;
}

function buildPoolRows(pools: PoolInForm[], usdRate: number): PoolPdfRow[] {
  const result: PoolPdfRow[] = [];
  for (const p of pools) {
    const quantity = Number(p.quantity || 1);
    const currency: 'ARS' | 'USD' = p.currency === 'USD' ? 'USD' : 'ARS';
    const priceOriginal = Number(p.price || 0);
    const subtotalOriginal = priceOriginal * quantity;
    const subtotalArs = currency === 'ARS' ? subtotalOriginal : usdRate > 0 ? subtotalOriginal * usdRate : 0;
    const subtotalUsd = currency === 'USD' ? subtotalOriginal : usdRate > 0 ? subtotalOriginal / usdRate : 0;
    result.push({
      brand: p.brand || '',
      model: p.model || '',
      quantity: Number.isInteger(quantity) ? quantity : quantity,
      price_str: fmtMoney(priceOriginal),
      subtotal_str: fmtMoney(subtotalOriginal),
      currency,
      subtotal_ars: subtotalArs,
      subtotal_usd: subtotalUsd,
    });
  }
  return result;
}

function asMaterials(raw: unknown): MaterialInForm[] {
  return (parseJsonList(raw) as MaterialInForm[]).filter(Boolean);
}

function asPools(raw: unknown): PoolInForm[] {
  return (parseJsonList(raw) as PoolInForm[]).filter(Boolean);
}

/**
 * Build the canonical PDF data object from the current `EntityFormState`.
 *
 * Used by both the preview modal (in /admin/budgets/new and
 * /admin/work-orders/new) and the eventual download button. The `sketch` is
 * a list of base64 PNG data URIs rendered from the Konva stage via
 * `stage.toDataURL()` in the page-level handler — passing empty list when
 * there's nothing to show keeps the layout symmetrvc.
 *
 * `company` and `terms` come from the settings endpoint (`useSettingsWithTerms`
 * hook) — these are the values shown in the header + footer of the PDF and
 * the per-document overrides that the user might have edited inline.
 */
export interface BuildPdfDataParams {
  /** Form state (from useEntityForm) OR raw API response (from getBudget/getWorkOrder).
   *  String JSON fields (materials_data, pools_data, fabrication_details) are
   *  parsed internally so both shapes work without mapApiToForm. */
  form: Record<string, unknown>;
  document_type: DocumentType;
  overrides?: {
    budget_terms?: string[];
    delivery_terms?: string[];
    warranty_terms?: string[];
  };
  company: CompanyInfo;
  globalTerms: TermsInfo;
  sketchImages?: string[];
}

export function buildPdfData({
  form,
  document_type,
  overrides,
  company,
  globalTerms,
  sketchImages = [],
}: BuildPdfDataParams): PdfDocumentData {
  // Local accessors so `form` can be a raw API response (Record<string, unknown>)
  // OR a typed EntityFormState — both work without mapApiToForm.
  const str = (k: string): string => (form[k] as string | null | undefined) ?? '';
  const num = (k: string): number => Number(form[k]) || 0;

  const allMaterials = asMaterials(form.materials_data);
  const mainMaterials = allMaterials.filter((m) => !m.is_alternative);
  const alternatives = allMaterials.filter((m) => m.is_alternative);

  const pools = asPools(form.pools_data);
  const usdRate = num('usd_rate');
  if (document_type === 'budget') {
    // Budgets show all materials (main + alternatives).
    const materialRows = buildMaterialRows([...mainMaterials, ...alternatives], usdRate);
    const poolRows = buildPoolRows(pools, usdRate);

    return {
      document_type,
      title: 'PRESUPUESTO',
      number: str('number'),
      doc_sub: STATUS_SUB_MAP[str('status')] || '',
      date: formatDate(form.date),
      client_name: str('client_name'),
      client_phone: str('client_phone'),
      client_address: str('client_address'),
      client_email: str('client_email'),
      material_color: str('color'),
      material_thickness: str('thickness'),
      material_finish: str('finish'),
      delivery_date: formatDate(form.delivery_date),
      fabrication_details: buildFabricationRows(form.fabrication_details, usdRate),
      materials: materialRows,
      pools: poolRows,
      subtotal: num('subtotal'),
      transport: num('transport'),
      discount_percentage: num('discount_percentage'),
      discount_fixed_amount: num('discount_fixed_amount'),
      deposit_received: num('deposit_received'),
      balance_due: Math.max(0, num('balance_due')),
      total: num('total'),
      total_usd: num('total_usd'),
      payment_method: str('payment_method'),
      installments: num('installments') || 1,
      notes: str('notes'),
      important_observations: str('important_observations'),
      important_observations_list: splitTerms(form.important_observations),
      budget_terms_list: overrides?.budget_terms && overrides.budget_terms.length > 0
        ? overrides.budget_terms
        : globalTerms.budget_terms,
      delivery_terms_list: overrides?.delivery_terms && overrides.delivery_terms.length > 0
        ? overrides.delivery_terms
        : globalTerms.delivery_terms,
      warranty_terms_list: overrides?.warranty_terms && overrides.warranty_terms.length > 0
        ? overrides.warranty_terms
        : globalTerms.warranty_text,
      sketch_images: sketchImages,
      company,
    };
  }

  // Work order: only main materials (alternatives are budget-side).
  const materialRows = buildMaterialRows(mainMaterials, usdRate);
  const poolRows = buildPoolRows(pools, usdRate);

  return {
    document_type,
    title: 'ORDEN DE TRABAJO',
    number: str('number'),
    doc_sub: STATUS_SUB_MAP[str('status')] || '',
    date: formatDate(form.date),
    client_name: str('client_name'),
    client_phone: str('client_phone'),
    client_address: str('client_address'),
    client_email: str('client_email'),
    material_color: str('color'),
    material_thickness: str('thickness'),
    material_finish: str('finish'),
      delivery_date: formatDate(form.delivery_date),
      fabrication_details: buildFabricationRows(form.fabrication_details, usdRate),
      materials: materialRows,
      pools: poolRows,
    subtotal: num('subtotal'),
    transport: num('transport'),
    discount_percentage: num('discount_percentage'),
    discount_fixed_amount: num('discount_fixed_amount'),
    deposit_received: num('deposit_received'),
    balance_due: Math.max(0, num('balance_due')),
    total: num('total'),
    total_usd: num('total_usd'),
    payment_method: str('payment_method'),
    installments: num('installments') || 1,
    notes: str('notes'),
    important_observations: str('important_observations'),
    important_observations_list: splitTerms(form.important_observations),
    budget_terms_list: [],
    delivery_terms_list: overrides?.delivery_terms && overrides.delivery_terms.length > 0
      ? overrides.delivery_terms
      : globalTerms.delivery_terms,
    warranty_terms_list: overrides?.warranty_terms && overrides.warranty_terms.length > 0
      ? overrides.warranty_terms
      : globalTerms.warranty_text,
    sketch_images: sketchImages,
    company,
  };
}

export { fmtMoney, fmtNum };