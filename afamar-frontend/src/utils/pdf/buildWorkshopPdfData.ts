/**
 * Data builder for the "FICHA DE TALLER" (workshop sheet) PDF.
 *
 * This is a SEPARATE document from the client-facing budget/work-order PDF
 * (`buildPdfData.ts`): it has NO prices, NO totals, NO payment terms. It is
 * a technical sheet for the shop-floor workers:
 *
 *   - order number
 *   - material + pool type
 *   - the croquis / plano (already rasterized to PNG by `SketchImageExtractor`)
 *   - the workshop spec grid (Corte, Faja, Perf, Tras/PEG, Term, Sopapas) —
 *     printed BLANK so the workers fill them in by hand with pen on the sheet.
 *
 * OT-only: budgets don't render it.
 */
import type { CompanyInfo } from './pdfTypes';
import { POOL_MATERIAL_GLOBAL } from '../../types/budget';

export interface WorkshopSpecCell {
  key: string;
  label: string;
  value: string;
}

/** One croquis page rasterized for the sheet, labeled with the page name
 *  and the material the worker chose for that drawing ('' when unset). */
export interface WorkshopSketchPage {
  name: string;
  material: string;
  image: string;
}

/** One pool rendered on the taller sheet, with the mesada it belongs to
 *  (`material` from `PoolInForm.material`): a concrete material name, the
 *  `__GLOBAL__` sentinel, or '' when unassigned (main section). `display`
 *  is the ready-to-print chip text — `"1.85 X 0.58 GRIS PERLA"` when the
 *  pool carries its mesada dimensions, otherwise just the material name. */
export interface WorkshopPoolCell {
  label: string;
  material: string;
  display: string;
}

export interface WorkshopPdfData {
  document_type: 'workshop_sheet';
  company: CompanyInfo;
  number: string;
  date: string;
  client_name: string;
  /** ALL main (non-alternative) material names — the workers cut every one. */
  materials: string[];
  /** ALL pools (brand + model) with the mesada each one is assigned to. */
  pools: WorkshopPoolCell[];
  specs: WorkshopSpecCell[];
  design_observations: string;
  sketch_pages: WorkshopSketchPage[];
}

/** Form slice keys the builder reads (matches `EntityFormState` snake_case). */
interface WorkshopFormLike {
  number?: unknown;
  work_order_number?: unknown;
  date?: unknown;
  client_name?: unknown;
  material?: unknown;
  materials_data?: unknown;
  pools_data?: unknown;
  design_observations?: unknown;
  sketch_elements?: unknown;
  [key: string]: unknown;
}

interface PoolLike {
  brand?: unknown;
  model?: unknown;
  material?: unknown;
  mesada_length?: unknown;
  mesada_width?: unknown;
}

interface MaterialLike {
  name?: unknown;
  is_alternative?: unknown;
  length?: unknown;
  width?: unknown;
}

/** A croquis page from the form (`savePayload` shape: `{ pagina_id, name,
 *  material, dibujo }`). Material is best-effort. */
interface SketchPageLike {
  name?: unknown;
  nombre?: unknown;
  material?: unknown;
}

/** Parse a JSON-string-or-array form field into a real array. */
function asArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* fall through to [] */
    }
  }
  return [];
}

/** Round a measurement to a compact 2-decimal string ("1.85", "0.60"). */
function fmtDim(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return n.toFixed(2);
}

/** Resolve EVERY pool (brand + model) with the mesada it's assigned to
 *  (`PoolInForm.material`: a material name, `__GLOBAL__`, or undefined).
 *  `display` is the chip text: `DIMS MATERIAL` when the pool carries its own
 *  mesada dimensions (chosen in the form dropdown), or `DIMS MATERIAL` from
 *  matching main `materials_data` rows when it was assigned by name only
 *  (legacy). Multiple matching mesadas are joined with " / ". */
function resolvePoolCells(raw?: unknown, materialsData?: unknown): WorkshopPoolCell[] {
  const mats = asArray(materialsData).map((it) => it as unknown as MaterialLike);
  return asArray(raw)
    .map((it) => {
      const p = it as unknown as PoolLike;
      const label = [p.brand, p.model].filter(Boolean).join(' ').trim();
      const material = typeof p.material === 'string' ? p.material : '';

      let display = material;
      const ownDims =
        Number.isFinite(Number(p.mesada_length)) &&
        Number.isFinite(Number(p.mesada_width));
      if (ownDims) {
        display = `${fmtDim(p.mesada_length)} X ${fmtDim(p.mesada_width)} ${material}`.trim();
      } else if (material && material !== POOL_MATERIAL_GLOBAL) {
        const matches = mats
          .filter((m) => m.is_alternative !== true && String(m.name || '').trim() === material)
          .filter((m) => Number.isFinite(Number(m.length)) && Number.isFinite(Number(m.width)))
          .map((m) => `${fmtDim(m.length)} X ${fmtDim(m.width)}`);
        if (matches.length > 0) {
          display = `${matches.join(' / ')} ${material}`.trim();
        }
      }

      return { label, material, display };
    })
    .filter((cell) => cell.label.length > 0);
}

/** Pick the MAIN material names: `form.material` first (validated against the
 *  catalogue), then every non-alternative row of `materials_data`. Alternate
 *  options are quotes, NOT things to cut — they never belong on the taller
 *  sheet. Falls back to ALL names when the data has no main rows at all. */
function resolveMaterialNames(form: WorkshopFormLike): string[] {
  const rawDirect = form.material;
  const direct = typeof rawDirect === 'string' ? rawDirect.trim() : '';
  const rows = asArray(form.materials_data)
    .map((it) => it as unknown as MaterialLike)
    .map((m) => ({ name: ((m.name as string) || '').trim(), alt: m.is_alternative === true }));

  const mains = rows.filter((m) => !m.alt).map((m) => m.name).filter(Boolean);
  const sources = mains.length > 0 ? mains : rows.map((m) => m.name).filter(Boolean);
  const unique = Array.from(new Set(sources));

  if (unique.length > 0) return unique;
  return direct ? [direct] : [];
}

/** Zip the rasterized croquis PNGs (one per page, in order) with the page
 *  metadata (`name` + `material`) from `form.sketch_elements`. The images
 *  come from `SketchImageExtractor`, which emits them in the same order as
 *  the normalized pages. */
function resolveSketchPages(form: WorkshopFormLike, sketchImages: string[]): WorkshopSketchPage[] {
  let rawPages: unknown[] = [];
  const raw = form.sketch_elements;
  if (Array.isArray(raw)) rawPages = raw;
  return sketchImages.map((image, i) => {
    const p = (rawPages[i] as SketchPageLike | undefined) || {};
    const name = String(p.name || p.nombre || `Página ${i + 1}`);
    const material = typeof p.material === 'string' ? p.material : '';
    return { name, material, image };
  });
}

const SPEC_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'workshop_corte', label: 'Corte' },
  { key: 'workshop_faja', label: 'Faja' },
  { key: 'workshop_perf', label: 'Perf.' },
  { key: 'workshop_tras_peg', label: 'Tras. / Peg.' },
  { key: 'workshop_term', label: 'Term.' },
  { key: 'workshop_sopapas', label: 'Sopapas' },
];

const EMPTY_SPEC_VALUE = '';

export function buildWorkshopPdfData(opts: {
  form: WorkshopFormLike;
  company: CompanyInfo;
  sketchImages: string[];
  /** Default when neither `number` nor `work_order_number` is present. */
  defaultNumber?: string;
}): WorkshopPdfData {
  const { form, company, sketchImages, defaultNumber = '' } = opts;

  const number =
    String(form.number || form.work_order_number || '') || defaultNumber;

  return {
    document_type: 'workshop_sheet',
    company,
    number,
    date: String(form.date || ''),
    client_name: String(form.client_name || ''),
    materials: resolveMaterialNames(form),
    pools: resolvePoolCells(form.pools_data, form.materials_data),
    design_observations: String(form.design_observations || ''),
    sketch_pages: resolveSketchPages(form, sketchImages),
    // The taller spec grid is ALWAYS printed blank — the shop-floor workers
    // fill it by hand with pen on the printed sheet. Nothing is read from
    // the form: no inputs exist for these cells in the web form.
    specs: SPEC_FIELDS.map((f) => ({
      key: f.key,
      label: f.label,
      value: EMPTY_SPEC_VALUE,
    })),
  };
}