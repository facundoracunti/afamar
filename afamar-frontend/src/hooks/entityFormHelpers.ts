import type { EntityFormState, Pool } from '../types';
import type { Material } from '../types/material';
import { POOL_MATERIAL_GLOBAL, type MaterialInForm, type PoolInForm } from '../types/budget';
import type { FinancialBase } from '../types/shared';
import { fabricationConcepts, todayLocalISO } from '../utils/formatters';

// Re-export so existing call sites that import `todayLocalISO` from this
// module keep working (notably the `useFormActions` / `useConfirmPayment`
// hooks pulled in by `useEntityForm`).
export { todayLocalISO };

/**
 * Fabrication concepts that are priced per square meter (m²).
 * Derived from `fabricationConcepts` so adding a new m² concept to the
 * canonical list automatically makes it available here.
 */
export const M2_CONCEPTS: string[] = fabricationConcepts.filter((c) =>
  c === 'BASEBOARD' || c === 'FRONT'
);

export const CUTOUT_DETAILS: Record<string, string> = {
  CUTOUT_SINK: 'Apertura y pegado de pileta',
  CUTOUT_COOKTOP: 'Apertura de anafe',
  CUTOUT_DROPIN_SINK: 'Apertura pileta de apoyo',
};

/**
 * Default values for the 17 FinancialBase fields used at the start of a new
 * budget / work order. Spread into `INITIAL_FORM` so there's a single source
 * of truth for both the form state defaults and the wire format.
 */
export const DEFAULT_FINANCIALS: FinancialBase = {
  currency: 'ARS',
  usd_rate: 1000,
  subtotal: 0,
  transport: 0,
  total: 0,
  subtotal_usd: 0,
  transport_usd: 0,
  total_usd: 0,
  deposit_received: 0,
  deposit_currency: 'ARS',
  deposit_usd: 0,
  balance_due: 0,
  balance_due_usd: 0,
  payment_method: '',
  installments: 1,
  discount_percentage: 0,
  discount_fixed_amount: 0,
};

/**
 * Serialize the FinancialBase portion of `EntityFormState` for the API.
 * Coerces to `number` (drops NaN to 0) and falls back to safe defaults
 * for empty strings (`currency`, `deposit_currency`).
 */
export function buildFinancialPayload(form: EntityFormState): FinancialBase {
  return {
    currency: form.currency || 'ARS',
    usd_rate: Number(form.usd_rate) || 1000,
    subtotal: Number(form.subtotal),
    transport: Number(form.transport),
    total: Number(form.total),
    subtotal_usd: Number(form.subtotal_usd) || 0,
    transport_usd: Number(form.transport_usd) || 0,
    total_usd: Number(form.total_usd) || 0,
    deposit_received: Number(form.deposit_received),
    deposit_currency: form.deposit_currency || 'ARS',
    deposit_usd: Number(form.deposit_usd) || 0,
    balance_due: Number(form.balance_due),
    balance_due_usd: Number(form.balance_due_usd) || 0,
    payment_method: form.payment_method || null,
    installments: Number(form.installments) || 1,
    discount_percentage: Number(form.discount_percentage) || 0,
    discount_fixed_amount: Number(form.discount_fixed_amount) || 0,
  };
}

/**
 * Reverse of `buildFinancialPayload`: parse FinancialBase fields out of an
 * API response row, applying the same defaults used by `DEFAULT_FINANCIALS`.
 */
export function mapFinancialToForm(d: Record<string, unknown>): FinancialBase {
  return {
    currency: (d.currency as string) || 'ARS',
    usd_rate: (d.usd_rate as number) ?? 1000,
    subtotal: (d.subtotal as number) || 0,
    transport: (d.transport as number) || 0,
    total: (d.total as number) || 0,
    subtotal_usd: (d.subtotal_usd as number) || 0,
    transport_usd: (d.transport_usd as number) || 0,
    total_usd: (d.total_usd as number) || 0,
    deposit_received: (d.deposit_received as number) || 0,
    deposit_currency: (d.deposit_currency as string) || 'ARS',
    deposit_usd: (d.deposit_usd as number) || 0,
    balance_due: (d.balance_due as number) || 0,
    balance_due_usd: (d.balance_due_usd as number) || 0,
    payment_method: (d.payment_method as string) || '',
    installments: (d.installments as number) || 1,
    discount_percentage: (d.discount_percentage as number) ?? 0,
    discount_fixed_amount: (d.discount_fixed_amount as number) ?? 0,
  };
}


// Form state uses snake_case English field names that match the backend API exactly.
// See app/schemas/budget.py (BudgetBase/BudgetCreate) and app/schemas/work_order.py (WorkOrderBase).
export const INITIAL_FORM: EntityFormState = {
  // Client info
  client_name: '',
  client_phone: '',
  client_address: '',
  client_email: '',
  delivery_address_id: null,

  // Budget/work order identifier & status
  number: '',
  // `date` is intentionally empty here — `useEntityForm` seeds it to
  // today's local calendar day on mount for new documents (so the
  // date is fresh per-mount, not per-module-import). For edits,
  // `mapApiToForm` populates it from the API response.
  date: '',
  status: '',

  // Material specs (BudgetBase)
  material: '',
  material_price_m2: 0,
  color: '',
  thickness: '',
  finish: '',
  bacha: '',
  anafe: '',
  pool_id: '',
  pool_price: 0,
  pool_currency: 'ARS',
  pool_image: '',

  // Money (FinancialBase) — defaults shared with both BudgetPayload and
  // WorkOrderPayload. See DEFAULT_FINANCIALS above.
  ...DEFAULT_FINANCIALS,
  // Extra balance-payment fields only present on the form (not in payloads).
  balance_paid: false,
  balance_paid_at: '',

  // Dates & signature
  delivery_date: '',
  digital_signature: null,
  signed_at: '',

  // Observations
  notes: '',
  design_observations: '',
  important_observations: '',

  // Fabrication
  fabrication_details: [],

  // Arrays (serialized to *_data JSON when sending to API)
  materials_data: [] as unknown[],
  pools_data: [] as unknown[],
  sketch_elements: [] as unknown[],
  // JSON-encoded list of selected additional works from the catalogue
  // (persisted in `additional_works_data` on the budget / work-order row).
  // Empty when no additional works are picked; the AdditionalWorksSection
  // component on the form re-parses on mount and on every change.
  additional_works_data: null,



  // Client-side only (not sent to API directly, used in UI for extra controls)
  work_order_number: null,

  // Per-entity override term lists (default empty; per-page useState supplies actual values for PDF preview)
  budget_terms: [],
  warranty_terms: [],
  delivery_terms: [],
};

// Map snake_case form fields to snake_case API fields. Since fields match exactly,
// this is essentially a passthrough with date serialization.
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
    // Backend stores *_data fields as JSON-encoded strings in TEXT columns
    // (Pydantic schemas declare them `str | None`). JSON-encoding here
    // matches the convention used by the Términos / Garantía /
    // Observaciones cards.
    fabrication_details: jsonStringify(form.fabrication_details),
    materials_data: jsonStringify(form.materials_data),
    pools_data: jsonStringify(form.pools_data),
    // sketch_elements is a TEXT column on the backend, so we send the
    // JSON string. The flat-list shape (output of flattenSketchElements)
    // is what the unflatten side reads back.
    sketch_elements: jsonStringify(flattenSketchElements(form.sketch_elements)),
    // `additional_works_data` is already a JSON string in the form
    // (AdditionalWorksSection keeps it that way). Pass it through verbatim
    // — empty list serialises to "[]" which the backend stores as such.
    additional_works_data: form.additional_works_data || '[]',
  };
}

/** JSON-encode for the API. `undefined`/`null` become `null` (the column
 *  accepts null). Empty arrays are encoded as `[]` so round-trips preserve
 *  the distinction between "not provided" and "explicitly empty". */
function jsonStringify(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

/**
 * Flatten the SketchEditor's `savePayload()` shape into the flat list of
 * `{type, data, order}` that the backend's `BudgetSketchElementCreate`
 * schema expects. **All geometry (points, x, y, stroke, strokeWidth, id, ...)**
 * is serialized into `data` so the round-trip preserves the exact drawing.
 *
 * `useSketchState.savePayload()` returns:
 *   [{ pagina_id, name, dibujo: [{ type, x, y, points, stroke, ...id }] }, ...]
 *
 * Accepts that shape plus a few legacy shapes for backward-compat:
 *  - { pages: [{ elements: [...] }], pageIdx }
 *  - { elements: [...] }
 *  - [...] (already flat)
 */
function flattenSketchElements(raw: unknown): { type: string; data: string | null; order: number }[] {
  if (!raw) return [];
  const out: { type: string; data: string | null; order: number }[] = [];
  const tryPush = (e: Record<string, unknown>, fallbackOrder: number) => {
    if (typeof e.type !== 'string') return;
    // Build a copy of the element without `type` and `order` (which are
    // stored as separate columns) so the geometry survives the round-trip.
    const { type: _t, order: _o, ...rest } = e;
    void _t;
    void _o;
    let dataStr: string | null = null;
    try {
      dataStr = JSON.stringify(rest);
    } catch {
      dataStr = null;
    }
    out.push({
      type: e.type,
      data: dataStr,
      order: typeof e.order === 'number' ? e.order : fallbackOrder,
    });
  };

  // The current editor shape: ARRAY of pages, each with `dibujo: []` of
  // elements. `pagina_id` and `name` are page-level metadata we discard.
  if (Array.isArray(raw)) {
    const looksLikePagesArray = raw.length === 0 || raw.every((p) => p && typeof p === 'object' && ('dibujo' in p || 'pagina_id' in p || 'elements' in p));
    if (looksLikePagesArray) {
      let order = 0;
      raw.forEach((page: unknown) => {
        const obj = page as Record<string, unknown> | null;
        if (!obj) return;
        const dibujo = obj.dibujo;
        if (Array.isArray(dibujo)) {
          dibujo.forEach((e) => tryPush(e as Record<string, unknown>, order++));
        } else if (Array.isArray(obj.elements)) {
          obj.elements.forEach((e) => tryPush(e as Record<string, unknown>, order++));
        }
      });
      return out;
    }
    // Direct flat list of elements.
    raw.forEach((e, idx) => tryPush(e as Record<string, unknown>, idx));
    return out;
  }

  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.pages)) {
      // Legacy editor shape: { pages: [{ elements: [...] }], pageIdx }
      let order = 0;
      obj.pages.forEach((page: unknown) => {
        const elements = (page as Record<string, unknown> | null)?.elements;
        if (Array.isArray(elements)) {
          elements.forEach((e) => tryPush(e as Record<string, unknown>, order++));
        }
      });
    } else if (Array.isArray(obj.elements)) {
      let order = 0;
      obj.elements.forEach((e) => tryPush(e as Record<string, unknown>, order++));
    }
  }
  return out;
}

/**
 * Reverse of `flattenSketchElements`. The wire format is a flat list of
 * `{type, data, order}` where `data` is a JSON string holding the full
 * element (minus type/order). We re-hydrate each element by merging
 * `type` back in and wrap the result in a single editor page so the
 * SketchEditor can render it as-is.
 *
 * Accepts both an array (Budget `sketch_elements` relationship, also
 * the shape used by `flattenSketchElements` on the way out) and a
 * JSON-encoded string (the WorkOrder.sketch_elements TEXT column gets
 * serialised by the backend, so a converted-from-budget WO returns a
 * string here). The form state is always an array.
 */
function unflattenSketchElements(raw: unknown): { pagina_id: number; name: string; dibujo: unknown[] }[] {
  let arr: unknown[] = [];
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (typeof raw === 'string' && raw.length > 0) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) arr = parsed;
    } catch {
      // Treat as empty — better to render nothing than crash the editor.
    }
  }
  if (arr.length === 0) return [];
  return [{
    pagina_id: 1,
    name: 'Página 1',
    dibujo: arr.map((e) => {
      if (!e || typeof e !== 'object') return e;
      const obj = e as Record<string, unknown>;
      const { type, data, order: _o, ...rest } = obj;
      void _o;
      // data is the JSON-serialized element (without type/order). Re-hydrate.
      let parsed: Record<string, unknown> = {};
      if (typeof data === 'string' && data.length > 0) {
        try { parsed = JSON.parse(data) as Record<string, unknown>; } catch { parsed = {}; }
      } else if (data && typeof data === 'object') {
        parsed = data as Record<string, unknown>;
      }
      return { ...parsed, type };
    }),
  }];
}

/** Parse a JSON-encoded string from the API into a list. Returns `[]`
 *  on null/empty/invalid input (so the form state always has a list
 *  to render, even for legacy rows that pre-date this convention). */
function jsonParseList(raw: unknown): unknown[] {
  if (raw === null || raw === undefined || raw === '') return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // Legacy fallback: a `;` or newline-separated string.
      return raw
        .split(/[;\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

// Backend snake_case field names are identical to form snake_case field names.
// We only need to slice ISO datetime strings to YYYY-MM-DD for date inputs.
export function mapApiToForm(d: Record<string, unknown>, defaultStatus: string): EntityFormState {
  return {
    ...INITIAL_FORM,
    ...mapFinancialToForm(d),
    client_name: (d.client_name as string) || '',
    client_phone: (d.client_phone as string) || '',
    client_address: (d.client_address as string) || '',
    client_email: (d.client_email as string) || '',
    delivery_address_id: (d.delivery_address_id as number | null) ?? null,
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
    fabrication_details: jsonParseList(d.fabrication_details) as EntityFormState['fabrication_details'],
    materials_data: jsonParseList(d.materials_data),
    pools_data: jsonParseList(d.pools_data),
    sketch_elements: unflattenSketchElements(d.sketch_elements) as unknown[],
    // Snapshot list of selected additional works (JSON string). `null` if
    // the budget predates the catalogue feature; `''` if the operator
    // removed every selected additional work. The picker component
    // (AdditionalWorksSection) re-parses on mount.
    additional_works_data: (d.additional_works_data as string | null) ?? null,
  };
}

function toIsoFromDate(dateStr: string): string | null {
  if (!dateStr) return null;
  // Send YYYY-MM-DD strings as-is. The backend parses them as midnight on
  // that day, so the round-trip preserves the date the user picked even when
  // the user's local timezone differs from the server's (which used to shift
  // the date by a day after `new Date(...).toISOString()` conversion).
  return dateStr;
}

function sliceDateToInput(v: unknown): string {
  if (!v) return '';
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export function addMaterialToList(
  form: EntityFormState,
  materials: Material[],
  name: string
): MaterialInForm[] | null {
  if (!name) return null;
  const mat = materials.find((m) => m.name === name);
  if (!mat) return null;
  const current = (form.materials_data as unknown as MaterialInForm[]) || [];
  return [
    ...current,
    {
      // Catalogue row id is preserved on the snapshot so downstream
      // pickers (e.g. Frente / Regrueso "Asignar material") can refer
      // back to `materials.id` and the backend can apply the formula
      // against the right row. Optional + nullable for legacy rows
      // produced before this field existed.
      id: mat.id,
      name: mat.name,
      category: mat.category_id ? String(mat.category_id) : '',
      color: mat.color || '',
      price_m2: mat.base_price || 0,
      price_m2_usd: mat.price_usd || 0,
      currency: mat.currency || 'ARS',
      quantity: 1,
      m2_used: 0,
      m2_budgeted: 0,
      length: 0,
      width: 0,
      is_alternative: false,
    } as unknown as MaterialInForm,
  ];
}

/**
 * Pick the default `material` link for a freshly-added pool.
 *
 * Priority: first main material in the form (most common case — the pool
 * ships with the principal option) > `POOL_MATERIAL_GLOBAL` (sensible
 * fallback when the user hasn't loaded any material yet).
 */
function defaultPoolMaterial(form: EntityFormState): string {
  const materials = (form.materials_data as unknown as MaterialInForm[]) || [];
  const firstMain = materials.find((m) => !m.is_alternative);
  if (firstMain) return firstMain.name;
  return POOL_MATERIAL_GLOBAL;
}

export function addPoolToList(
  form: EntityFormState,
  pools: Pool[],
  pid: string
): PoolInForm[] | null {
  if (!pid) return null;
  const pt = pools.find((p) => p.id === Number(pid));
  if (!pt) return null;
  const current = (form.pools_data as unknown as PoolInForm[]) || [];
  return [
    ...current,
    {
      pool_id: pt.id,
      brand: pt.brand,
      model: pt.model,
      price: pt.price || 0,
      currency: 'ARS' as const,
      image: '',
      quantity: 1,
      material: defaultPoolMaterial(form),
    } as unknown as PoolInForm,
  ];
}