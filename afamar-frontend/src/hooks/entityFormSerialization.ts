/**
 * Entity form ↔ API serialization orchestrator.
 *
 * The thin facade that ``useEntityForm`` consumes. Splits into focused
 * submodules in this folder:
 *
 *   * ``sketch.ts``          — sketch page ↔ wire format (`[{pagina_id,
 *                              name, material?, dibujo}]` ↔
 *                              `[{type, data, order}]` legacy).
 *   * ``piecesHydration.ts`` — bake the budgeted-measurement snapshot
 *                              onto each piece so the COMPARATIVA DE
 *                              MEDICIÓN survives any round-trip.
 *
 * Public API unchanged (``buildPayload``, ``mapApiToForm``,
 * ``hydratePiecesSnapshots``, ``todayLocalISO``) so the existing tests +
 * callers keep working.
 */

import type { EntityFormState } from '../types';
import type { BudgetPiece, FabricationDetail, MaterialInForm, PoolInForm } from '../types/budget';
import { todayLocalISO } from '../utils/formatters';
import { INITIAL_FORM } from './entityFormConstants';
import { buildFinancialPayload, mapFinancialToForm } from './entityFormFinancial';
import { flattenPieces, normalisePieces } from '@features/budgets/utils/pieces';
import {
  serializeSketchPages,
  unflattenSketchElements,
} from './entityForm/sketch';
import {
  hydratePiecesSnapshots,
} from './entityForm/piecesHydration';

export { todayLocalISO };
export {
  serializeSketchPages,
  unflattenSketchElements,
  type SketchWireElement,
  type SketchWirePage,
} from './entityForm/sketch';
export {
  hydratePiecesSnapshots,
  hydrateSnapshotKeys,
  SNAPSHOT_MATERIAL_KEYS,
  SNAPSHOT_FABRICATION_KEYS,
  SNAPSHOT_ADDITIONAL_KEYS,
} from './entityForm/piecesHydration';

function jsonStringify(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
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
function isLegacyAlternative(m: Record<string, unknown>): boolean {
  return Boolean((m as { is_alternative?: unknown }).is_alternative)
    || Boolean((m as { es_alternativa?: unknown }).es_alternativa);
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
function loadPieces(
  d: Record<string, unknown>,
): { pieces: BudgetPiece[]; pools_data: PoolInForm[] } {
  const pieces = normalisePieces(d.pieces_data);
  const hadPiecesData =
    (typeof d.pieces_data === 'string' && d.pieces_data.length > 0) ||
    (Array.isArray(d.pieces_data) && (d.pieces_data as unknown[]).length > 0);

  if (!hadPiecesData) {
    const legacyMats = jsonParseList(d.materials_data) as Array<Record<string, unknown>>;
    if (legacyMats.length > 0 && pieces.length === 1 && pieces[0].mainMaterial === null) {
      const legacyMains = legacyMats.filter((m) => !isLegacyAlternative(m));
      const firstMain = legacyMains[0] || null;
      // Extra non-alternative rows (legacy "panes" of the principal) become
      // `mainMaterialRows` tramos — each keeps its own dims so the re-split
      // UI can show/editar every tramo after loading a legacy budget.
      const mainRows = legacyMains
        .slice(1)
        .map((m) => ({ ...m, is_alternative: false })) as BudgetPiece['mainMaterialRows'];
      const alts = legacyMats
        .filter(isLegacyAlternative)
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
    date: form.date ? sliceDateToInput(form.date) : null,
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
    delivery_date: form.delivery_date ? sliceDateToInput(form.delivery_date) : null,
    digital_signature: form.digital_signature,
    signed_at: form.signed_at ? sliceDateToInput(form.signed_at) : null,
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
    // derived flat columns are computed ONCE (see `loadPieces` below) so
    // the legacy migration runs once and the flat arrays are guaranteed
    // to match the pieces (no drift between `pools_data` and `piece.pools`,
    // which was a bug in the previous duplicated-IIFE implementation).
    ...loadPieces(d),
    materials_data: jsonParseList(d.materials_data) as EntityFormState['materials_data'],
    sketch_elements: unflattenSketchElements(d.sketch_elements) as unknown[],
    additional_works_data: (d.additional_works_data as string | null) ?? null,
    // Per-cuota breakdown persisted by the backend. Empty list when
    // the active method isn't a credit-card percentage surcharge.
    installment_detail_ars: jsonParseList(d.installment_detail_ars) as EntityFormState['installment_detail_ars'],
    installment_detail_usd: jsonParseList(d.installment_detail_usd) as EntityFormState['installment_detail_usd'],
  };
}

// Re-export the piece types so older callers that imported them via
// `entityFormSerialization` still type-check (the canonical definitions
// live in `types/budget.ts`).
export type { BudgetPiece, FabricationDetail, MaterialInForm, PoolInForm };
