/**
 * Sketch wire-format serialisation — pages ↔ {pagina_id, name, material?, dibujo}.
 *
 * The WO form persists croquis as a list of pages so the taller-sheet PDF
 * can read the per-page material label and the editor can survive a
 * reload with all pages intact. Historically the wire format was a flat
 * `[{type, data, order}]` element list that collapsed every multi-page
 * croquis into "Página 1" — ``serializeSketchPages`` / ``unflattenSketchElements``
 * still accept the legacy flat list as input and wrap it into a single
 * page so old budgets keep round-tripping.
 */

export type SketchWireElement = { type: string; data: string | null; order: number };

export interface SketchWirePage {
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
export function serializeSketchPages(raw: unknown): SketchWirePage[] {
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
export function unflattenSketchElements(raw: unknown): SketchWirePage[] {
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
