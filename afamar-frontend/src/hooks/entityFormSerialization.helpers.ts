/**
 * Low-level helpers shared by the entity-form serialization modules.
 *
 * Split out of `entityFormSerialization.ts` (which stays the public
 * barrel): the JSON coercions, the date slicing and the legacy-alternative
 * flag live here so the payload builder, the form mapper and the pieces
 * loader all share ONE definition of each.
 */

/**
 * Serialize a value to JSON, tolerating `undefined` / `null` and cyclic
 * structures (both become `null`).
 */
export function jsonStringify(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

/**
 * Parse a list-ish value (JSON array, JSON string, or a `;`/newline
 * separated text) into an array. Never throws.
 */
export function jsonParseList(raw: unknown): unknown[] {
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

/** Slice an ISO-ish date down to the `YYYY-MM-DD` an `<input type="date">`
 *  accepts (shorter values are returned untouched). */
export function sliceDateToInput(v: unknown): string {
  if (!v) return '';
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/** A legacy material row carries either `is_alternative` (English, used
 *  by the current form) or `es_alternativa` (Spanish, persisted by old
 *  builds). Treat both as the alternative flag so the v3 migration can
 *  split legacy `materials_data` into `mainMaterial` / `alternativeMaterials`. */
export function isLegacyAlternative(m: Record<string, unknown>): boolean {
  return Boolean((m as { is_alternative?: unknown }).is_alternative)
    || Boolean((m as { es_alternativa?: unknown }).es_alternativa);
}
