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
import { POOL_MATERIAL_GLOBAL } from '../../types/budget';

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
  /**
   * Mirrors `PoolInForm.material`. Used by `buildSections` to bucket the
   * pool into the right PDF section: empty/undefined → main section,
   * `POOL_MATERIAL_GLOBAL` → extras/global section, anything else → the
   * material section matching this name. Not rendered into the PDF cells
   * (consumed only during section bucketing).
   */
  readonly material: string;
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
  /**
   * Per-material breakdown of the document. One section per main material
   * or alternative (when the document has alternatives) plus an "Extras /
   * Global" section for fabrication details that weren't assigned to any
   * material. Each section carries its own materials, pools, fabrication
   * rows and subtotals so the renderer can lay out one block per option.
   */
  sections: MaterialSection[];
  /**
   * Flat concatenation of all fabrication rows across sections — kept for
   * backward compat with the totals logic and any external consumer that
   * still iterates the flat list. Prefer `sections[*].fabrication_details`.
   */
  fabrication_details: PdfDataRow[];
  /** Flat concatenation of all material rows across sections. Prefer `sections`. */
  materials: MaterialPdfRow[];
  /** Flat concatenation of all pool rows across sections. Prefer `sections`. */
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

/**
 * One self-contained block in the PDF layout. For budgets with alternatives
 * the renderer prints one section per option (Principal + Alternativa 1..N)
 * with its own tables and subtotal, then optionally an "Extras / Global"
 * section for unassigned fabrication details. For work orders there's a
 * single main section (no alternatives on the WO side).
 */
export interface MaterialSection {
  /** Display title, e.g. "PRINCIPAL: GRIS MARA" / "ALTERNATIVA 1: TAJ MAHAL" / "EXTRAS / GLOBAL". */
  title: string;
  /** True for the main-material section (is_alternative === false on the source rows). */
  is_main: boolean;
  /** True for the catch-all section that holds fabrication details without a `material` link. */
  is_global: boolean;
  /** Section index in the original budget — undefined for global / work orders. */
  alternative_index?: number;
  /** Material name (e.g. "GRIS MARA"). Empty string for the global section. */
  material_name: string;
  materials: MaterialPdfRow[];
  pools: PoolPdfRow[];
  fabrication_details: PdfDataRow[];
  subtotal_ars: number;
  subtotal_usd: number;
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
      material: p.material || '',
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

/**
 * Group materials, pools and fabrication details into per-option sections.
 *
 * Logic:
 * - One section per main material (all `!is_alternative` materials collapse
 *   into a single "PRINCIPAL" section so the PDF doesn't have N blocks when
 *   the user picked several main materials).
 * - One section per alternative (label "ALTERNATIVA 1: <name>" etc.).
 *
 * If every material is marked as an alternative (no main), we DO NOT
 * create a phantom "PRINCIPAL" page and we DO NOT auto-promote any
 * alternative to main. Alternatives stay as alternatives. The document
 * becomes comparison-only — no section has `is_main: true` so no page
 * renders the grand total / payment method / signatures. The user has to
 * uncheck one of the "Alternativa" checkboxes in the form before
 * generating a signing PDF.
 *
 * Each section is self-contained: it includes the material/option-specific
 * rows (material/pools/fab linked to that option) AND the common "global"
 * extras (fabrication details with no `material` link, plus pools flagged
 * as `POOL_MATERIAL_GLOBAL`). That way the customer can see the full
 * price-per-option at a glance, with no need for a separate "EXTRAS /
 * GLOBAL" card at the bottom of the document.
 *
 * The document grand total is the main section's subtotal (since the
 * customer only executes one option). Alternatives are quoted for
 * comparison but DO NOT add into the grand total.
 */
function buildSections(
  allMaterials: MaterialInForm[],
  alternatives: MaterialInForm[],
  pools: PoolInForm[],
  fabricationRows: PdfDataRow[],
  usdRate: number,
): { sections: MaterialSection[]; flatMaterials: MaterialPdfRow[]; flatPools: PoolPdfRow[]; flatFabrication: PdfDataRow[]; subtotalMain: number; subtotalGlobal: number } {
  const mainMaterials = allMaterials.filter((m) => !m.is_alternative);
  const flatMaterials: MaterialPdfRow[] = [];
  const flatPools: PoolPdfRow[] = [];
  const flatFabrication: PdfDataRow[] = [];
  const sections: MaterialSection[] = [];

  const mainMaterialRows = buildMaterialRows(mainMaterials, usdRate);
  const allPoolRows = buildPoolRows(pools, usdRate);
  // Bucket pools by their `material` field:
  // - POOL_MATERIAL_GLOBAL ('__GLOBAL__') or empty/undefined → folded into
  //   every section's rows (common to all options). Empty is treated as
  //   Global for backward compat with data persisted before the explicit
  //   "Asignar a opción" feature landed.
  // - any other string → that material's section only.
  const poolsByMaterial: Record<string, PoolPdfRow[]> = {};
  const poolsCommon: PoolPdfRow[] = [];
  for (const poolRow of allPoolRows) {
    const linkedMaterial = poolRow.material;
    if (!linkedMaterial || linkedMaterial === POOL_MATERIAL_GLOBAL) {
      poolsCommon.push(poolRow);
    } else {
      if (!poolsByMaterial[linkedMaterial]) poolsByMaterial[linkedMaterial] = [];
      poolsByMaterial[linkedMaterial].push(poolRow);
    }
  }
  // Same bucketing for fabrication details.
  const fabricationByMaterial: Record<string, PdfDataRow[]> = {};
  const fabricationCommon: PdfDataRow[] = [];
  for (const row of fabricationRows) {
    // The `material` field on FabricationDetail doubles as the option link.
    // We don't propagate it into the row's PDF rendering — only use it here
    // to bucket rows into sections.
    const detailMaterial = row.material;
    if (detailMaterial && detailMaterial.length > 0) {
      if (!fabricationByMaterial[detailMaterial]) fabricationByMaterial[detailMaterial] = [];
      fabricationByMaterial[detailMaterial].push(row);
    } else {
      fabricationCommon.push(row);
    }
  }

  // ---------- 1) Main section ----------
  // The "main" section is the one the customer signs (gets the totals,
  // payment method, and signatures). It exists only when at least one
  // material is NOT marked as an alternative. If every material is marked
  // as an alternative, we DON'T create a phantom "PRINCIPAL" page and
  // we DON'T auto-promote any alternative — alternatives stay as
  // alternatives. The customer will need to mark one as the principal
  // (uncheck the "Alternativa" checkbox) before generating the PDF if
  // they want a signing page; otherwise the PDF is a comparison-only
  // document with no grand total / signatures.
  const hasMain = mainMaterials.length > 0;

  const mainFabrication: PdfDataRow[] = [...fabricationCommon];
  for (const m of mainMaterials) {
    if (fabricationByMaterial[m.name]) {
      mainFabrication.push(...fabricationByMaterial[m.name]);
    }
  }
  const mainPoolRows: PoolPdfRow[] = [...poolsCommon];
  for (const m of mainMaterials) {
    if (poolsByMaterial[m.name]) {
      mainPoolRows.push(...poolsByMaterial[m.name]);
    }
  }
  const mainSubtotalArs =
    mainMaterialRows.reduce((s, r) => s + r.subtotal_ars, 0) +
    mainPoolRows.reduce((s, r) => s + r.subtotal_ars, 0) +
    mainFabrication.reduce((s, r) => s + r.subtotal_ars, 0);
  const mainSubtotalUsd =
    mainMaterialRows.reduce((s, r) => s + r.subtotal_usd, 0) +
    mainPoolRows.reduce((s, r) => s + r.subtotal_usd, 0) +
    mainFabrication.reduce((s, r) => s + r.subtotal_usd, 0);
  const mainName = mainMaterials.length === 1 ? mainMaterials[0].name : '';

  // ---------- 2) One section per alternative ----------
  // Each alternative gets its own material + linked fab + linked pools +
  // the COMMON extras (so all options can be compared apples-to-apples).
  // No auto-promotion — alternatives stay as alternatives with is_main=false.
  const builtAlternatives: MaterialSection[] = [];
  alternatives.forEach((alt, idx) => {
    const altMaterialRows = buildMaterialRows([alt], usdRate);
    const altFabrication: PdfDataRow[] = [
      ...fabricationCommon,
      ...(fabricationByMaterial[alt.name] ?? []),
    ];
    const altPools: PoolPdfRow[] = [
      ...poolsCommon,
      ...(poolsByMaterial[alt.name] ?? []),
    ];
    const altSubtotalArs =
      altMaterialRows.reduce((s, r) => s + r.subtotal_ars, 0) +
      altPools.reduce((s, r) => s + r.subtotal_ars, 0) +
      altFabrication.reduce((s, r) => s + r.subtotal_ars, 0);
    const altSubtotalUsd =
      altMaterialRows.reduce((s, r) => s + r.subtotal_usd, 0) +
      altPools.reduce((s, r) => s + r.subtotal_usd, 0) +
      altFabrication.reduce((s, r) => s + r.subtotal_usd, 0);
    builtAlternatives.push({
      title: `ALTERNATIVA ${idx + 1}: ${alt.name}`,
      is_main: false,
      is_global: false,
      alternative_index: idx,
      material_name: alt.name,
      materials: altMaterialRows,
      pools: altPools,
      fabrication_details: altFabrication,
      subtotal_ars: altSubtotalArs,
      subtotal_usd: altSubtotalUsd,
    });
  });

  if (hasMain) {
    // Normal case: there's a real principal material. Push it as a section
    // and push the alternatives as-is.
    sections.push({
      title: `PRINCIPAL${mainName ? `: ${mainName}` : ''}`,
      is_main: true,
      is_global: false,
      material_name: mainName,
      materials: mainMaterialRows,
      pools: mainPoolRows,
      fabrication_details: mainFabrication,
      subtotal_ars: mainSubtotalArs,
      subtotal_usd: mainSubtotalUsd,
    });
    flatMaterials.push(...mainMaterialRows);
    flatPools.push(...mainPoolRows);
    flatFabrication.push(...mainFabrication);
    sections.push(...builtAlternatives);
    for (const a of builtAlternatives) {
      flatMaterials.push(...a.materials);
      flatPools.push(...a.pools);
      flatFabrication.push(...a.fabrication_details);
    }
  } else {
    // No main material: every material is marked as an alternative. We
    // don't create a phantom "PRINCIPAL" page and we don't auto-promote
    // any alternative. Just render the alternatives as-is. Without a
    // main section, the document grand total falls back to 0 (only
    // transport / discount / seña contribute) and no page gets the
    // signatures / payment method — the customer has to uncheck one of
    // the "Alternativa" checkboxes in the form to get a signing page.
    sections.push(...builtAlternatives);
    for (const a of builtAlternatives) {
      flatMaterials.push(...a.materials);
      flatPools.push(...a.pools);
      flatFabrication.push(...a.fabrication_details);
    }
  }

  // `subtotalGlobal` is always 0 now — the common extras are folded into
  // every section's rows, so there's no separate "Extras / Global" block
  // to count. Kept in the return shape for backward compat with the
  // caller in `buildPdfData`, which still does
  // `computedSubtotal = subtotalMain + subtotalGlobal`.
  return {
    sections,
    flatMaterials,
    flatPools,
    flatFabrication,
    subtotalMain: mainSubtotalArs,
    subtotalGlobal: 0,
  };
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

  // Build fabrication rows once and bucket them into sections.
  const fabricationRows = buildFabricationRows(form.fabrication_details, usdRate);
  const {
    sections,
    flatMaterials,
    flatPools,
    flatFabrication,
    subtotalMain,
    subtotalGlobal,
  } = buildSections(
    document_type === 'work_order' ? mainMaterials : allMaterials,
    document_type === 'work_order' ? [] : alternatives,
    pools,
    fabricationRows,
    usdRate,
  );

  // Document subtotal = main + global. Alternatives are quoted but not
  // summed into the grand total (the customer only executes one of them).
  // We override the stored `form.subtotal` / `form.total` / `form.balance_due`
  // with the section-based computation because the stored values include
  // alternatives' subtotals (the backend sums everything when it persists).
  const computedSubtotal = subtotalMain + subtotalGlobal;
  const transport = num('transport');
  const discountFixed = num('discount_fixed_amount');
  const deposit = num('deposit_received');
  const computedTotal = Math.max(0, computedSubtotal + transport - discountFixed);
  const computedBalanceDue = Math.max(0, computedTotal - deposit);

  const base: PdfDocumentData = {
    document_type,
    title: document_type === 'budget' ? 'PRESUPUESTO' : 'ORDEN DE TRABAJO',
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
    sections,
    fabrication_details: flatFabrication,
    materials: flatMaterials,
    pools: flatPools,
    subtotal: computedSubtotal,
    transport,
    discount_percentage: num('discount_percentage'),
    discount_fixed_amount: discountFixed,
    deposit_received: deposit,
    balance_due: computedBalanceDue,
    total: computedTotal,
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

  if (document_type === 'budget') {
    base.budget_terms_list = overrides?.budget_terms && overrides.budget_terms.length > 0
      ? overrides.budget_terms
      : globalTerms.budget_terms;
  }

  return base;
}

export { fmtMoney, fmtNum };