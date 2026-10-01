/**
 * Hydrate the budgeted-measurement snapshots from the API's flat arrays
 * onto the loaded pieces so they survive the pieces → flat re-derivation
 * on every edit (see ``useBudgetPieces.commit`` → ``flattenPieces``).
 *
 * Without this hydration the COMPARATIVA DE MEDICIÓN's "Presupuestado"
 * column dies at the first measurement change because:
 *   1. the backend bakes the snapshot onto the FLAT arrays at conversion
 *      time (`work_order.create_from_budget`),
 *   2. but the pieces themselves never carried the snapshot keys,
 *   3. so the next commit re-derives the flat arrays from the pieces and
 *      strips the snapshot.
 *
 * Mirrors `pdf_html._build_measurement_comparison` + the frontend
 * `buildSectionData.buildMeasurementComparison` consumers; keep all three
 * in sync when adding snapshot keys.
 */
import type { BudgetPiece, FabricationDetail, MaterialInForm } from '../../types/budget';

/** A legacy material row carries either `is_alternative` (English, used
 *  by the current form) or `es_alternativa` (Spanish, persisted by old
 *  builds). Treat both as the alternative flag so the v3 migration can
 *  split legacy `materials_data` into `mainMaterial` / `alternativeMaterials`. */
function isLegacyAlternative(m: Record<string, unknown>): boolean {
  return Boolean((m as { is_alternative?: unknown }).is_alternative)
    || Boolean((m as { es_alternativa?: unknown }).es_alternativa);
}

/** Snapshot keys the COMPARATIVA DE MEDICIÓN reads. */
export const SNAPSHOT_MATERIAL_KEYS = ['m2_budgeted'] as const;
export const SNAPSHOT_FABRICATION_KEYS = [
  'm2_budgeted', 'linear_meters_budgeted', 'total_ars_budgeted', 'total_usd_budgeted',
] as const;
export const SNAPSHOT_ADDITIONAL_KEYS = [
  'total_ars_budgeted', 'total_usd_budgeted', 'linear_meters_budgeted',
] as const;

/** Copy a subset of snapshot keys from a flat source row onto a piece row
 *  (returns the same row reference when nothing carries a snapshot). */
export function hydrateSnapshotKeys<Row>(
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

function jsonParseList(raw: unknown): unknown[] {
  if (raw === null || raw === undefined || raw === '') return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Copy the budgeted-measurement snapshots from the API's flat arrays
 *  onto the loaded pieces so the JSON persisted on the next save keeps
 *  them (the bug described above). */
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
  const mainFlat = flatMats.filter((row) => !isLegacyAlternative(row));
  const altFlat = flatMats.filter((row) => isLegacyAlternative(row));
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
    next.additional_works_data = JSON.stringify(hydratedAdd) || '[]';
    return next;
  });
}
