import type { EntityFormState, Pool } from '../types';
import type { Material } from '../types/material';
import type { MaterialInForm, PoolInForm } from '../types';

/**
 * Fabrication concept codes. English keys are the canonical (DB) values;
 * the UI translates them to Spanish via `t()`.
 *
 * The `detalle` values are operator-facing strings (PDF, quote lines) so
 * they stay in Spanish — they are content, not codes.
 */
export const M2_CONCEPTS: string[] = ['BASEBOARD', 'FRONT'];

export const CUTOUT_DETAILS: Record<string, string> = {
  CUTOUT_SINK: 'Apertura y pegado de pileta',
  CUTOUT_COOKTOP: 'Apertura de anafe',
  CUTOUT_DROPIN_SINK: 'Apertura pileta de apoyo',
};

/**
 * Maps legacy Spanish concept strings (from data created before the
 * English-only migration) to the canonical English code. Used when
 * loading `fabrication_details` from the API to keep the form's in-memory
 * state consistent.
 */
export const CONCEPT_NORMALIZE: Record<string, string> = {
  'ZÓCALO': 'BASEBOARD',
  'FRENTE': 'FRONT',
  'LONGITUD': 'LENGTH',
  'TRAFORO DE PILETA': 'CUTOUT_SINK',
  'TRAFORO DE ANAFE': 'CUTOUT_COOKTOP',
  'TRAFORO DE PILETA DE APOYO': 'CUTOUT_DROPIN_SINK',
  'APERTURA + PEGADO PILETA': 'CUTOUT_SINK',
  'APERTURA Y PEGADO DE PILETA': 'CUTOUT_SINK',
  'APERTURA ANAFE': 'CUTOUT_COOKTOP',
  'APERTURA DE ANAFE': 'CUTOUT_COOKTOP',
  'APERTURA PILETA APOYO': 'CUTOUT_DROPIN_SINK',
  'APERTURA PILETA DE APOYO': 'CUTOUT_DROPIN_SINK',
  'OTRA': 'OTHER',
};

// Form state uses snake_case English field names that match the backend API exactly.
// See app/schemas/budget.py (BudgetBase/BudgetCreate) and app/schemas/work_order.py (WorkOrderBase).
export const INITIAL_FORM: EntityFormState = {
  // Client info
  client_name: '',
  client_phone: '',
  client_address: '',
  client_email: '',

  // Budget/work order identifier & status
  number: '',
  date: new Date().toISOString().slice(0, 10),
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

  // Money (BudgetBase / WorkOrderBase)
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
  balance_paid: false,
  balance_paid_at: '',
  payment_method: '',
  installments: 1,
  discount_percentage: 0,
  discount_fixed_amount: 0,

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
    balance_paid: form.balance_paid || false,
    balance_paid_at: form.balance_paid_at || null,
    payment_method: form.payment_method,
    installments: form.installments || 1,
    discount_percentage: Number(form.discount_percentage) || 0,
    discount_fixed_amount: Number(form.discount_fixed_amount) || 0,
    delivery_date: form.delivery_date ? toIsoFromDate(form.delivery_date) : null,
    digital_signature: form.digital_signature,
    signed_at: form.signed_at ? toIsoFromDate(form.signed_at) : null,
    notes: form.notes,
    design_observations: form.design_observations,
    important_observations: form.important_observations,
    fabrication_details: form.fabrication_details,
    materials_data: form.materials_data,
    pools_data: form.pools_data,
    sketch_elements: form.sketch_elements,
  };
}

// Backend snake_case field names are identical to form snake_case field names.
// We only need to slice ISO datetime strings to YYYY-MM-DD for date inputs.
export function mapApiToForm(d: Record<string, unknown>, defaultStatus: string): EntityFormState {
  return {
    ...INITIAL_FORM,
    client_name: (d.client_name as string) || '',
    client_phone: (d.client_phone as string) || '',
    client_address: (d.client_address as string) || '',
    client_email: (d.client_email as string) || '',
    number: (d.number as string) || (d.numero as string) || '',
    date: sliceDateToInput(d.date) || new Date().toISOString().slice(0, 10),
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
    balance_paid: (d.balance_paid as boolean) || false,
    balance_paid_at: sliceDateToInput(d.balance_paid_at) || '',
    payment_method: (d.payment_method as string) || '',
    installments: (d.installments as number) || 1,
    discount_percentage: (d.discount_percentage as number) ?? 0,
    discount_fixed_amount: (d.discount_fixed_amount as number) ?? 0,
    delivery_date: sliceDateToInput(d.delivery_date) || '',
    digital_signature: (d.digital_signature as string) || null,
    signed_at: sliceDateToInput(d.signed_at) || sliceDateToInput(d.signed_at) || '',
    notes: (d.notes as string) || '',
    design_observations: (d.design_observations as string) || '',
    important_observations: (d.important_observations as string) || '',
    fabrication_details: ((d.fabrication_details as EntityFormState['fabrication_details']) || []) as EntityFormState['fabrication_details'],
    materials_data: ((d.materials_data as unknown[]) || []) as unknown[],
    pools_data: ((d.pools_data as unknown[]) || []) as unknown[],
    sketch_elements: ((d.sketch_elements as unknown[]) || []) as unknown[],
  };
}

function toIsoFromDate(dateStr: string): string | null {
  if (!dateStr) return null;
  if (dateStr.length === 10) return new Date(dateStr + 'T00:00:00').toISOString();
  return new Date(dateStr).toISOString();
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
    } as unknown as PoolInForm,
  ];
}
