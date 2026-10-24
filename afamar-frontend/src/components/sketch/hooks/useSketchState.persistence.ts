/**
 * `useSketchState` — persistence (wire payload + history snapshots).
 *
 *  - `savePayload`  — editor pages → the wire the backend stores.
 *  - `clonePages`   — deep-ish copy used for the undo/redo history.
 *  - `canonicalJSON` — key-order-insensitive JSON used by the re-init guard.
 */
import type { SketchPage } from '../../../types/sketch';

/** Editor pages → the wire payload handed to `onChange`. */
export function savePayload(pages: SketchPage[]): unknown {
  return pages.map((p) => ({
    pagina_id: p.id,
    name: p.name,
    material: p.material || undefined,
    dibujo: p.elements.map(({ id, ...rest }) => ({ ...rest, id })),
  }));
}

/** Deep-ish copy of the pages (elements are copied one level). */
export function clonePages(pages: SketchPage[]): SketchPage[] {
  return pages.map((p) => ({ ...p, elements: p.elements.map((el) => ({ ...el })) }));
}

/** Deeply sort object keys so `JSON.stringify` outputs become order-agnostic.
 *
 * Used by the re-init guard in `useSketchState`: `setPageMaterial` and the
 * other page mutators apply `{ ...p, material }` which APPENDS the key to the
 * end of the page object, while `normPages` rebuilds the page with `material`
 * in the middle. Two objects with the same fields but different key order
 * compare unequal under `JSON.stringify` → every material pick would trigger a
 * re-init (jumping back to page 0 and resetting undo history). Sorting both
 * sides first makes the guard see "structurally identical" as identical. */
export function canonicalJSON(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => sortKeysDeep(v));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    Object.keys(value as Record<string, unknown>)
      .sort()
      .forEach((k) => {
        out[k] = sortKeysDeep((value as Record<string, unknown>)[k]);
      });
    return out;
  }
  return value;
}
