/**
 * Build a `QuoteOptionsGrid` `Alternativa` row from a `MaterialInForm`.
 *
 * Pure function — moves the per-material calculation that used to live
 * inline in `BudgetFormPage` into a reusable helper. Kept as a function
 * (not a hook) because it has no state and the same result is shared by
 * both the principal and alternative sides of the grid.
 */
import type { MaterialInForm } from '../types/budget';
import type { MaterialSection } from './pdf/pdfTypes';

export interface AlternativaDetailRow {
  concept: string;
  quantity?: number;
  /** Value in the row's own (native) currency. */
  total: number;
  currency: 'ARS' | 'USD';
  materialName?: string | null;
}

export interface AlternativaLike {
  name: string;
  category: string;
  currency: string;
  costoMaterialBase: number;
  totalFinalARS: number;
  length: number;
  width: number;
  quantity: number;
  /** Total m² for the option (length × width × quantity). */
  totalM2: number;
  /** Per-option ARS subtotal — the SUM the PDF draws for this alternative
   *  (material base + revalued zócalo/frente + traforos + pileta). When
   *  present, the grid uses this value for every total cell. */
  subtotalARS?: number;
  /** Per-option USD subtotal. */
  subtotalUSD?: number;
  /** Per-option detail lines (revalued zócalo/frente + traforos + pileta).
   *  When present, the grid renders these instead of the shared common jobs. */
  detail?: AlternativaDetailRow[];
}

export interface BuildOptionArgs {
  /** USD venta rate used to convert USD-priced material rows to ARS. */
  usdRate: number;
  /** Pre-computed ARS subtotal of all previously-iterated main materials.
   *  Added to the per-row cost so the option card shows the cumulative
   *  "total of the principal option" subtotal. */
  sumatoriaMaterialesPrincipalARS: number;
  /** ARS subtotal of common fabrication extras. Same purpose as above. */
  sumatoriaAdicionalesARS: number;
  /** Per-option ARS subtotal from the PDF section builder. Overrides the
   *  `sumatoriaAdicionalesARS`-based total when provided (paid per option). */
  subtotalARS?: number;
  /** Per-option USD subtotal from the PDF section builder. */
  subtotalUSD?: number;
  /** Per-option detail lines from the PDF section builder. */
  detail?: AlternativaDetailRow[];
}

export function buildOptionFromMaterial(
  mat: MaterialInForm,
  args: BuildOptionArgs,
): AlternativaLike {
  const usdRate = Number(args.usdRate) || 1;
  const m2 = Number(mat.length || 0) * Number(mat.width || 0) * (mat.quantity || 1);
  const costoMat = mat.currency === 'USD' ? m2 * (mat.price_m2_usd || 0) : m2 * (mat.price_m2 || 0);
  const costoMatArs = mat.currency === 'USD' && usdRate > 0 ? costoMat * usdRate : costoMat;
  const totalFinalARS =
    args.subtotalARS != null
      ? args.subtotalARS
      : args.sumatoriaMaterialesPrincipalARS + costoMatArs + args.sumatoriaAdicionalesARS;
  const defaultValue = mat.currency === 'USD' && usdRate > 0 ? costoMat : costoMatArs;
  return {
    name: mat.name || '',
    category: mat.category || '',
    currency: mat.currency || 'ARS',
    costoMaterialBase: costoMat,
    totalFinalARS,
    subtotalARS: args.subtotalARS != null ? args.subtotalARS : totalFinalARS,
    subtotalUSD:
      args.subtotalUSD != null ? args.subtotalUSD : (usdRate > 0 ? defaultValue / usdRate : 0),
    detail: args.detail,
    length: Number(mat.length || 0),
    width: Number(mat.width || 0),
    quantity: mat.quantity || 1,
    totalM2: m2,
  };
}

/**
 * Build the per-option detail lines the QUOTE OPTIONS GRID should show for a
 * single alternative, from its PDF `MaterialSection`. The material base is
 * NOT included here — the grid renders it as the separate "Costo Material
 * base" row from `costoMaterialBase`. Everything else (zócalo / m²
 * fabrication already revalued per option, piletas, traforos and the
 * revalued frente) becomes one line each, valued in each row's own currency
 * so the card mirrors the "Subtotal Opción" the PDF draws.
 */
export function buildDetailFromSection(section: MaterialSection): AlternativaDetailRow[] {
  const rows: AlternativaDetailRow[] = [];
  for (const f of section.fabrication_details) {
    const native = f.currency === 'USD' ? f.subtotal_usd : f.subtotal_ars;
    if (native === 0) continue;
    rows.push({ concept: f.concept, total: native, currency: f.currency });
  }
  for (const p of section.pools) {
    const native = p.currency === 'USD' ? p.subtotal_usd : p.subtotal_ars;
    if (native === 0) continue;
    rows.push({
      concept: `Pileta ${p.brand} ${p.model}`.trim(),
      quantity: p.quantity,
      total: native,
      currency: p.currency,
    });
  }
  for (const a of section.additional_works) {
    const native = a.currency === 'USD' ? a.subtotal_usd : a.subtotal_ars;
    if (native === 0) continue;
    rows.push({
      concept: a.name,
      quantity: a.type === 'frente' ? a.linear_meters : a.quantity,
      total: native,
      currency: a.currency,
    });
  }
  return rows;
}