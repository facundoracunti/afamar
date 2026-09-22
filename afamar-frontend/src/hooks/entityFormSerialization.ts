/**
 * Entity form ↔ API serialization helpers.
 */

import type { EntityFormState } from '../types';
import type { BudgetPiece, PoolInForm } from '../types/budget';
import type { FabricationDetail, MaterialInForm } from '../types/budget';
import { todayLocalISO } from '../utils/formatters';
import { INITIAL_FORM } from './entityFormConstants';
import { buildFinancialPayload, mapFinancialToForm } from './entityFormFinancial';
import { flattenPieces, normalisePieces } from '@features/budgets/utils/pieces';

export { todayLocalISO };

function jsonStringify(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

type SketchWireElement = { type: string; data: string | null; order: number };

interface SketchWirePage {
  pagina_id: number;
  name: string;
  material?: string;
  dibujo: unknown[];
}

/** Compact a single drawn element to the wire `{type, data, order}` shape. */
function toWireElement(e: Record<string, unknown>, order: number): SketchWireElement | null {
  if (typeof e.type !== 'string') return null;
  const { type: _t, order: _o, data, ...rest } = e;
  void _t;
  void _o;
  // If the element is already in wire shape (`data` is a JSON string of
  // the geometry), reuse it verbatim — double-stringifying it would break
  // the round-trip for legacy flat lists fed into the form.
  if (typeof data === 'string' && data.length > 0) {
    return { type: e.type, data, order };
  }
  let dataStr: string | null = null;
  if (data && typeof data === 'object') {
    try {
      dataStr = JSON.stringify(data);
    } catch {
      dataStr = null;
    }
  } else if (data === null || data === undefined) {
    try {
      dataStr = JSON.stringify(rest);
    } catch {
      dataStr = null;
    }
  } else {
    // Odd scalar payload — keep as-is.
    return { type: e.type, data: String(data), order };
  }
  return { type: e.type, data: dataStr, order };
}

/** Expand a wire element back into its geometry (`{...data, type}`). */
function fromWireElement(e: Record<string, unknown>): unknown {
  const { type, data, order: _o, ...rest } = e;
  void _o;
  let parsed: Record<string, unknown> = {};
  if (typeof data === 'string' && data.length > 0) {
    try { parsed = JSON.parse(data) as Record<string, unknown>; } catch { parsed = {}; }
  } else if (data && typeof data === 'object') {
    parsed = data as Record<string, unknown>;
  }
  return { ...parsed, ...rest, type };
}

/**
 * Serialise the editor's page list to the wire format.
 *
 * Wire format (persisted by the backend):
 *   `[{ pagina_id, name, material?, dibujo: [{ type, data, order }] }, ...]`
 *
 * Pages PRESERVE their id, name and material — the taller-sheet PDF reads
 * the per-page material label from here. (Historically the wire format was
 * the FLAT element list `[{type,data,order}]`, which collapsed multi-page
 * croquis into "Página 1" on reload. Budget keeps producing flat rows for
 * the 1-N `BudgetSketchElement` table, but WorkOrders now persist the
 * full page shape.) Accepts the legacy flat element list as input too and
 * wraps it in a single page.
 */
function serializeSketchPages(raw: unknown): SketchWirePage[] {
  if (!raw) return [];

  const pageFrom = (
    obj: Record<string, unknown>,
    pageIdx: number,
    elements: unknown[],
  ): SketchWirePage => ({
    pagina_id: (obj.pagina_id as number) || (obj.id as number) || pageIdx + 1,
    name: String(obj.name || obj.nombre || `Página ${pageIdx + 1}`),
    material: typeof obj.material === 'string' && obj.material ? obj.material : undefined,
    dibujo: elements.map((e, idx) => toWireElement(e as Record<string, unknown>, idx)).filter((x): x is SketchWireElement => x !== null),
  });

  if (Array.isArray(raw)) {
    const looksLikePages = raw.length === 0 || raw.every((p) => p && typeof p === 'object' && ('dibujo' in p || 'pagina_id' in p || 'elements' in p));
    if (looksLikePages) {
      return raw.map((page: unknown, i: number) => {
        const obj = (page || {}) as Record<string, unknown>;
        const elements = Array.isArray(obj.dibujo) ? obj.dibujo : (Array.isArray(obj.elements) ? obj.elements : []);
        return pageFrom(obj, i, elements as unknown[]);
      });
    }
    // Legacy flat element list → wrap into a single page.
    return [pageFrom({}, 0, raw as unknown[])];
  }

  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.pages)) {
      return obj.pages.map((page: unknown, i: number) => {
        const p = (page || {}) as Record<string, unknown>;
        const elements = Array.isArray(p.elements) ? p.elements : [];
        return pageFrom(p, i, elements as unknown[]);
      });
    }
    if (Array.isArray(obj.elements)) {
      return [pageFrom({}, 0, obj.elements as unknown[])];
    }
  }
  return [];
}

/**
 * Rehydrate the wire format back into the editor's page list. Accepts either
 * the new page shape (`[{pagina_id, name, material?, dibujo}]`) or the legacy
 * flat element list (wrapped into a single "Página 1").
 */
function unflattenSketchElements(raw: unknown): SketchWirePage[] {
  let arr: unknown[] = [];
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (typeof raw === 'string' && raw.length > 0) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) arr = parsed;
    } catch {
      // Treat as empty
    }
  }
  if (arr.length === 0) return [];
  const looksLikePages = arr.every((p) => p && typeof p === 'object' && ('dibujo' in p || 'elements' in p) && !('type' in p));
  if (!looksLikePages) {
    // Legacy flat element list → single page.
    return [{
      pagina_id: 1,
      name: 'Página 1',
      dibujo: arr.map((e) => fromWireElement((e || {}) as Record<string, unknown>)),
    }];
  }
  return arr.map((page: unknown, i: number) => {
    const obj = (page || {}) as Record<string, unknown>;
    const elements = Array.isArray(obj.dibujo) ? obj.dibujo : (Array.isArray(obj.elements) ? obj.elements : []);
    return {
      pagina_id: (obj.pagina_id as number) || i + 1,
      name: String(obj.name || obj.nombre || `Página ${i + 1}`),
      material: typeof obj.material === 'string' ? obj.material : undefined,
      dibujo: elements.map((e) => fromWireElement((e || {}) as Record<string, unknown>)),
    };
  });
}

function jsonParseList(raw: unknown): unknown[] {
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

/** A legacy material row carries either `is_alternative` (English, used
 *  by the current form) or `es_alternativa` (Spanish, persisted by old
 *  builds). Treat both as the alternative flag so the v3 migration can
 *  split legacy `materials_data` into `mainMaterial` / `alternativeMaterials`. */
function _isLegacyAlternative(m: Record<string, unknown>): boolean {
  return Boolean((m as { is_alternative?: unknown }).is_alternative)
    || Boolean((m as { es_alternativa?: unknown }).es_alternativa);
}

/** Snapshot keys the COMPARATIVA DE MEDICIÓN reads. The backend writes
 *  them onto the FLAT arrays (`materials_data` / `fabrication_details` /
 *  `additional_works_data`) at budget→WO conversion time
 *  (`work_order.create_from_budget`), but the pieces themselves never
 *  carried them. `useBudgetPieces.commit` re-derives the flat arrays from
 *  the pieces on EVERY commit (`flattenPieces`), which wiped the snapshot
 *  at the first measurement edit → the "Presupuestado" column died in the
 *  PDF. We hydrate the snapshot keys from the flat arrays onto each
 *  piece's rows so the budgeted values survive any round-trip. Must be
 *  kept in sync with `pdf_html._build_measurement_comparison` + the
 *  frontend `buildSectionData.buildMeasurementComparison`. */
const SNAPSHOT_MATERIAL_KEYS = ['m2_budgeted'] as const;
const SNAPSHOT_FABRICATION_KEYS = [
  'm2_budgeted', 'linear_meters_budgeted', 'total_ars_budgeted', 'total_usd_budgeted',
] as const;
const SNAPSHOT_ADDITIONAL_KEYS = [
  'total_ars_budgeted', 'total_usd_budgeted', 'linear_meters_budgeted',
] as const;

/** Copy a subset of snapshot keys from a flat source row onto a piece row
 *  (returns the same row reference when nothing carries a snapshot). */
function hydrateSnapshotKeys<Row>(
  row: Row,
  source: Record<string, unknown> | null | undefined,
  keys: readonly string[],
): Row {
  if (!row || !source || typeof row !== 'object') return row;
  let changed = false;
  const next = { ...(row as Record<string, unknown>) };
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null) {
      next[key] = value;
      changed = true;
    }
  }
  return changed ? (next as Row) : row;
}

/** Copy the budgeted-measurement snapshots from the API's flat arrays
 *  onto the loaded pieces so the JSON persisted on the next save keeps
 *  them (the bug described above: without this, `m2_budgeted` etc. lived
 *  only in the flat arrays and died on the first piece edit). */
export function hydratePiecesSnapshots(
  d: Record<string, unknown>,
  pieces: BudgetPiece[],
): BudgetPiece[] {
  const flatMats = jsonParseList(d.materials_data) as Array<Record<string, unknown>>;
  const flatFab = jsonParseList(d.fabrication_details) as Array<Record<string, unknown>>;
  const flatAdd = jsonParseList(d.additional_works_data) as Array<Record<string, unknown>>;

  const hasAnySnapshot = [...flatMats, ...flatFab, ...flatAdd].some((row) =>
    SNAPSHOT_MATERIAL_KEYS.some((k) => row[k] !== undefined && row[k] !== null)
      || SNAPSHOT_FABRICATION_KEYS.some((k) => row[k] !== undefined && row[k] !== null)
      || SNAPSHOT_ADDITIONAL_KEYS.some((k) => row[k] !== undefined && row[k] !== null),
  );
  if (!hasAnySnapshot) return pieces;

  // Materials: the flat array keeps every non-alternative row (main +
  // tramos) then the alternatives — the same order `flattenPieces` emits,
  // which is the order the backend wrote them. Zip by class so a piece's
  // mainMaterial / mainMaterialRows line up with the flat non-alternative
  // rows and alternatives with the flat alternative rows.
  const mainFlat = flatMats.filter((row) => !_isLegacyAlternative(row));
  const altFlat = flatMats.filter((row) => _isLegacyAlternative(row));
  let mainIdx = 0;
  let altIdx = 0;
  let fabIdx = 0;
  let addIdx = 0;

  return pieces.map((piece) => {
    const next: BudgetPiece = { ...piece };

    if (piece.mainMaterial) {
      next.mainMaterial = hydrateSnapshotKeys<MaterialInForm>(
        piece.mainMaterial, mainFlat[mainIdx], SNAPSHOT_MATERIAL_KEYS,
      );
      mainIdx += 1;
    }
    next.mainMaterialRows = (piece.mainMaterialRows || []).map((row) => {
      const hydrated = hydrateSnapshotKeys<MaterialInForm>(
        row, mainFlat[mainIdx], SNAPSHOT_MATERIAL_KEYS,
      );
      mainIdx += 1;
      return hydrated;
    });
    next.alternativeMaterials = (piece.alternativeMaterials || []).map((row) => {
      const hydrated = hydrateSnapshotKeys<MaterialInForm>(
        row, altFlat[altIdx], SNAPSHOT_MATERIAL_KEYS,
      );
      altIdx += 1;
      return hydrated;
    });
    next.fabrication_details = (piece.fabrication_details || []).map((row) => {
      const hydrated = hydrateSnapshotKeys<FabricationDetail>(
        row, flatFab[fabIdx], SNAPSHOT_FABRICATION_KEYS,
      );
      fabIdx += 1;
      return hydrated;
    });
    // The piece's additional works are per-piece JSON; the flat array is
    // the concatenation of every piece's rows in piece order. Re-serialize
    // this piece's rows with the snapshots attached.
    const rawAdd = ((): Array<Record<string, unknown>> => {
      try {
        const parsed = JSON.parse(piece.additional_works_data || '[]');
        return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
      } catch {
        return [];
      }
    })();
    const hydratedAdd = rawAdd.map((row) => {
      const hydrated = hydrateSnapshotKeys<Record<string, unknown>>(
        row, flatAdd[addIdx], SNAPSHOT_ADDITIONAL_KEYS,
      );
      addIdx += 1;
      return hydrated;
    });
    next.additional_works_data = jsonStringify(hydratedAdd) || '[]';
    return next;
  });
}

/** Single source of truth for the pieces + their derived flat columns.
 *
 *  Pieces v3 guarantees the form always has ≥ 1 piece. When the backend
 *  returns no `pieces_data` (legacy budget), we fold the legacy flat
 *  arrays (`materials_data`, `fabrication_details`, `additional_works_data`,
 *  `pools_data`) into the auto-created first piece so nothing is lost on
 *  the first save. The `pools_data` returned to the form is then derived
 *  from the resulting pieces via `flattenPieces`, guaranteeing the flat
 *  column and the per-piece pools never drift. */
function _loadPieces(
  d: Record<string, unknown>,
): { pieces: BudgetPiece[]; pools_data: PoolInForm[] } {
  const pieces = normalisePieces(d.pieces_data);
  const hadPiecesData =
    (typeof d.pieces_data === 'string' && d.pieces_data.length > 0) ||
    (Array.isArray(d.pieces_data) && (d.pieces_data as unknown[]).length > 0);

  if (!hadPiecesData) {
    const legacyMats = jsonParseList(d.materials_data) as Array<Record<string, unknown>>;
    if (legacyMats.length > 0 && pieces.length === 1 && pieces[0].mainMaterial === null) {
      const legacyMains = legacyMats.filter((m) => !_isLegacyAlternative(m));
      const firstMain = legacyMains[0] || null;
      // Extra non-alternative rows (legacy "panes" of the principal) become
      // `mainMaterialRows` tramos — each keeps its own dims so the re-split
      // UI can show/editar every tramo after loading a legacy budget.
      const mainRows = legacyMains
        .slice(1)
        .map((m) => ({ ...m, is_alternative: false })) as BudgetPiece['mainMaterialRows'];
      const alts = legacyMats
        .filter(_isLegacyAlternative)
        .map((m) => ({ ...m, is_alternative: true })) as BudgetPiece['alternativeMaterials'];
      const legacyFab = jsonParseList(d.fabrication_details) as BudgetPiece['fabrication_details'];
      const legacyAdd = (typeof d.additional_works_data === 'string' && d.additional_works_data)
        ? d.additional_works_data
        : '[]';
      const legacyPools = jsonParseList(d.pools_data) as BudgetPiece['pools'];
      pieces[0] = {
        ...pieces[0],
        mainMaterial: firstMain
          ? ({ ...firstMain, is_alternative: false } as BudgetPiece['mainMaterial'])
          : null,
        mainMaterialRows: mainRows,
        alternativeMaterials: alts,
        fabrication_details: legacyFab,
        additional_works_data: legacyAdd,
        pools: legacyPools,
      };
    }
  }

  // Copy the budgeted-measurement snapshots (m²/ml + ARS/USD at
  // conversion) from the API's flat arrays onto the pieces so they
  // survive the pieces→flat re-derivation on every edit (see
  // `hydratePiecesSnapshots`). Without this the COMPARATIVA DE
  // MEDICIÓN loses the "Presupuestado" column at the first measurement
  // change and the flat `flattenPieces` output below would diverge from
  // the API's snapshot-carrying flat arrays.
  const hydrated = hydratePiecesSnapshots(d, pieces);

  return {
    pieces: hydrated,
    pools_data: flattenPieces(hydrated).pools_data,
  };
}

function toIsoFromDate(dateStr: string): string | null {
  if (!dateStr) return null;
  return dateStr;
}

function sliceDateToInput(v: unknown): string {
  if (!v) return '';
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export function buildPayload(form: EntityFormState): Record<string, unknown> {
  return {
    client_name: form.client_name,
    client_phone: form.client_phone,
    client_address: form.client_address,
    client_email: form.client_email,
    delivery_address_id: form.delivery_address_id ? Number(form.delivery_address_id) : null,
    date: form.date ? toIsoFromDate(form.date) : null,
    status: form.status,
    material: form.material,
    material_price_m2: Number(form.material_price_m2) || 0,
    color: form.color,
    thickness: form.thickness,
    finish: form.finish,
    bacha: form.bacha,
    anafe: form.anafe,
    pool_id: form.pool_id ? Number(form.pool_id) : undefined,
    pool_price: Number(form.pool_price) || 0,
    pool_currency: form.pool_currency || 'ARS',
    pool_image: form.pool_image,
    ...buildFinancialPayload(form),
    balance_paid: form.balance_paid || false,
    balance_paid_at: form.balance_paid_at || null,
    delivery_date: form.delivery_date ? toIsoFromDate(form.delivery_date) : null,
    digital_signature: form.digital_signature,
    signed_at: form.signed_at ? toIsoFromDate(form.signed_at) : null,
    notes: form.notes,
    design_observations: form.design_observations,
    important_observations: form.important_observations,
    include_measurement_comparison_in_pdf: form.include_measurement_comparison_in_pdf === true,
    fabrication_details: jsonStringify(form.fabrication_details),
    pieces_data: jsonStringify(form.pieces),
    materials_data: jsonStringify(form.materials_data),
    pools_data: jsonStringify(form.pools_data),
    sketch_elements: jsonStringify(serializeSketchPages(form.sketch_elements)),
    additional_works_data: form.additional_works_data || '[]',
    // Per-cuota breakdown computed by `useBudgetCalculations` (only set
    // when the active payment method is a credit-card percentage
    // surcharge). Serialised as JSON so the list-page PDF preview can
    // re-render the table even when the form hook isn't running.
    installment_detail_ars: form.installment_detail_ars
      ? JSON.stringify(form.installment_detail_ars)
      : null,
    installment_detail_usd: form.installment_detail_usd
      ? JSON.stringify(form.installment_detail_usd)
      : null,
  };
}

export function mapApiToForm(d: Record<string, unknown>, defaultStatus: string): EntityFormState {
  return {
    ...INITIAL_FORM,
    ...mapFinancialToForm(d),
    client_name: (d.client_name as string) || '',
    client_phone: (d.client_phone as string) || '',
    client_address: (d.client_address as string) || '',
    client_email: (d.client_email as string) || '',
    delivery_address_id: (d.delivery_address_id as number | null) ?? null,
    // Origin marker — only meaningful for work orders. Set to the id of
    // the budget this order was converted from; null for direct work
    // orders created manually. Drives the COMPARATIVA DE MEDICIÓN gate:
    // only work orders with a `budget_id` show the comparison toggle in
    // the form (direct orders skip it).
    budget_id: (d.budget_id as number | null) ?? null,
    number: (d.number as string) || (d.numero as string) || '',
    date: sliceDateToInput(d.date) || todayLocalISO(),
    status: (d.status as string) || (d.estado as string) || defaultStatus,
    material: (d.material as string) || '',
    material_price_m2: (d.material_price_m2 as number) || 0,
    color: (d.color as string) || '',
    thickness: (d.thickness as string) || '',
    finish: (d.finish as string) || '',
    bacha: (d.bacha as string) || '',
    anafe: (d.anafe as string) || '',
    pool_id: (d.pool_id as number | string | null | undefined) ?? '',
    pool_price: (d.pool_price as number) || 0,
    pool_currency: (d.pool_currency as string) || 'ARS',
    pool_image: (d.pool_image as string) || '',
    balance_paid: (d.balance_paid as boolean) || false,
    balance_paid_at: sliceDateToInput(d.balance_paid_at) || '',
    delivery_date: sliceDateToInput(d.delivery_date) || '',
    digital_signature: (d.digital_signature as string) || null,
    signed_at: sliceDateToInput(d.signed_at) || '',
    notes: (d.notes as string) || '',
    design_observations: (d.design_observations as string) || '',
    important_observations: (d.important_observations as string) || '',
    include_measurement_comparison_in_pdf: (d.include_measurement_comparison_in_pdf as boolean) ?? false,
    fabrication_details: jsonParseList(d.fabrication_details) as EntityFormState['fabrication_details'],
    // Pieces v3: pieces-only mode is the ONLY mode. The pieces + their
    // derived flat columns are computed ONCE (see `_loadPieces` below) so
    // the legacy migration runs once and the flat arrays are guaranteed
    // to match the pieces (no drift between `pools_data` and `piece.pools`,
    // which was a bug in the previous duplicated-IIFE implementation).
    ..._loadPieces(d),
    materials_data: jsonParseList(d.materials_data) as EntityFormState['materials_data'],
    sketch_elements: unflattenSketchElements(d.sketch_elements) as unknown[],
    additional_works_data: (d.additional_works_data as string | null) ?? null,
    // Per-cuota breakdown persisted by the backend. Empty list when
    // the active method isn't a credit-card percentage surcharge.
    installment_detail_ars: jsonParseList(d.installment_detail_ars) as EntityFormState['installment_detail_ars'],
    installment_detail_usd: jsonParseList(d.installment_detail_usd) as EntityFormState['installment_detail_usd'],
  };
}
