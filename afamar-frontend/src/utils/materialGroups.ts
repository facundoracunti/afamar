/** Helpers for the "Asignar material" pickers used by TRABAJO
 *  ADICIONAL (fabrication details) and the FRENTE / REGRUESO picker.
 *
 *  Problem: a budget can contain multiple `materials_data` rows for
 *  the SAME physical material (e.g. three panes of "Negro Brasil" with
 *  different length/width each). Rendering every row as a separate
 *  picker option duplicates the entry and forces the operator to either
 *  pick all three (meaningless) or pick one without realising it only
 *  links to that one row.
 *
 *  Solution: dedupe by `m.id ?? m.name`, aggregate the row count and
 *  total m², and render ONE option per physical material. The picker's
 *  value stays the material `name` (or `id`) so existing serialization
 *  and the backend's material lookup continue to work without changes.
 */
import type { MaterialInForm } from '../types/budget';
import { round2 } from './math';

export interface MaterialGroupOption {
  /** Stable bucket key — the catalogue `id` (preferred) or the material
   *  name (legacy fallback for snapshots created before `addMaterialToList`
   *  started storing the catalogue id). */
  groupKey: string;
  /** Display label — `Principal: <name>` or `Alternativa: <name>`. */
  label: string;
  /** Raw name the picker writes back to the row (used for both
   *  fabrication_details.material and the additional-works
   *  snapshot.materialName field). */
  name: string;
  /** True if any row in the group carries `is_alternative`. */
  isAlternative: boolean;
  /** Number of panes (i.e. `materials_data` rows) collapsed into this
   *  option. `1` for the common case (single pane). */
  count: number;
  /** Sum of `length * width * quantity` across the group, rounded to
   *  2dp. `0` when no row carries dimensions yet. */
  totalM2: number;
  /** Either USD or ARS — first row's currency wins. */
  currency: 'ARS' | 'USD';
}

function rowM2(m: MaterialInForm): number {
  return Number(m.length || 0) * Number(m.width || 0) * Number(m.quantity || 1);
}

/** Dedupe a `materials_data` snapshot so each *physical* material is
 *  represented by exactly one option in the picker. Groups by the
 *  catalogue id when present (the common case for new budgets) and
 *  falls back to the material name for legacy rows that predate the
 *  `addMaterialToList` fix.
 *
 *  Stable ordering: groups keep the order of their first occurrence in
 *  the input array, so the picker is stable across renders for the
 *  same data. */
export function buildMaterialGroupOptions(
  materials: MaterialInForm[],
): MaterialGroupOption[] {
  if (!materials || materials.length === 0) return [];
  const groups = new Map<string, {
    rows: MaterialInForm[];
    count: number;
    totalM2: number;
    currency: 'ARS' | 'USD';
  }>();
  for (const m of materials) {
    if (!m || !m.name) continue;
    const groupKey =
      m.id != null && Number.isFinite(m.id)
        ? String(m.id)
        : `name:${m.name}`;
    const existing = groups.get(groupKey);
    if (existing) {
      existing.count += 1;
      existing.totalM2 += rowM2(m);
      // Alternative wins over principal when mixed (so the picker
      // marks the group as alternativa even if one row is mis-tagged).
      if (m.is_alternative) existing.currency = m.currency === 'USD' ? 'USD' : 'ARS';
      existing.rows.push(m);
    } else {
      groups.set(groupKey, {
        rows: [m],
        count: 1,
        totalM2: rowM2(m),
        currency: m.currency === 'USD' ? 'USD' : 'ARS',
      });
    }
  }
  const out: MaterialGroupOption[] = [];
  for (const [groupKey, agg] of groups) {
    const representative = agg.rows[0];
    const anyAlt = agg.rows.some((r) => r.is_alternative);
    const headPrefix = anyAlt ? 'Alternativa: ' : 'Principal: ';
    const tailParts: string[] = [];
    if (agg.count > 1) tailParts.push(`${agg.count} planchas`);
    if (agg.totalM2 > 0) tailParts.push(`${round2(agg.totalM2).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`);
    const tail = tailParts.length ? ` — ${tailParts.join(' · ')}` : '';
    out.push({
      groupKey,
      label: `${headPrefix}${representative.name}${tail}`,
      name: representative.name,
      isAlternative: anyAlt,
      count: agg.count,
      totalM2: agg.totalM2,
      currency: agg.currency,
    });
  }
  return out;
}
