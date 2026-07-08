// Budget form schema types. Field names are in English snake_case to match the backend API exactly.
// Source of truth: afamar-backend/app/schemas/budget.py (BudgetBase / BudgetCreate / BudgetUpdate).

import type { FinancialBase } from './shared';

export interface FabricationDetail {
  concept: string;
  detail: string;
  custom_concept?: string;
  material?: string;
  material_price_m2?: number;
  length: number | null;
  width: number | null;
  m2: number;
  labor: number | null;
  currency: 'ARS' | 'USD';
  quantity: number;
  price: number;
}

export interface BudgetItemSchema {
  id?: number;
  sector?: string;
  lengthUnit?: string;
  widthUnit?: string;
  length?: number;
  width?: number;
  m2?: number;
  quantity?: number;
  price_m2?: number;
  subtotal?: number;
}

export interface BudgetAdditionalSchema {
  id?: number;
  concept?: string;
  detail?: string;
  quantity?: number;
  unitPrice?: number;
  subtotal?: number;
}

export interface MaterialInForm {
  name: string;
  category?: string;
  color?: string;
  price_m2: number;
  price_m2_usd: number;
  currency: 'ARS' | 'USD';
  quantity: number;
  m2_used: number;
  m2_budgeted: number;
  length: number;
  width: number;
  is_alternative: boolean;
}

/**
 * Sentinel value for the `material` field on `PoolInForm` that flags a pool
 * as "global" — i.e. the pool doesn't belong to any specific material/option
 * and should be rendered in the "EXTRAS / GLOBAL" section of the PDF,
 * contributing to the document grand total AND to each alternative's
 * subtotal (so the customer can compare alternatives apples-to-apples).
 *
 * Mirrors the "Global" option in `FabricationTable` for fabrication details.
 */
export const POOL_MATERIAL_GLOBAL = '__GLOBAL__' as const;

export interface PoolInForm {
  pool_id: number;
  brand: string;
  model: string;
  price: number;
  currency: 'ARS' | 'USD';
  image?: string;
  quantity: number;
  /**
   * Optional link to the material/alternative this pool belongs to:
   * - empty/undefined → main section (default — the pool is part of the
   *   principal option the customer is most likely to choose).
   * - `POOL_MATERIAL_GLOBAL` ('__GLOBAL__') → global / extras section
   *   (the pool is common to all options and adds to every subtotal).
   * - any other string → matches a material name and the pool is rendered
   *   inside that material's section in the PDF (so each alternative can
   *   carry its own sink).
   */
  material?: string;
}

export interface BudgetPayload extends FinancialBase {
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  client_address: string | null;
  /** Optional override — when the customer wants the work done at a
   *  non-default address (e.g. an architect with several project sites).
   *  `null` means "use the client's default address". */
  delivery_address_id: number | null;
  material: string | null;
  material_price_m2: number;
  materials_data: string | null;
  color: string | null;
  thickness: string | null;
  finish: string | null;
  bacha: string | null;
  anafe: string | null;
  balance_paid: boolean;
  balance_paid_at: string | null;
  delivery_date: string | null;
  digital_signature: string | null;
  signed_at: string | null;
  design_observations: string | null;
  important_observations: string | null;
  notes: string | null;
  fabrication_details: string | null;
  pool_id: number | null;
  pool_price: number;
  pool_currency: string;
  pool_image: string | null;
  pools_data: string | null;
  items?: unknown[];
  adicionales?: unknown[];
  sketch_elements?: unknown[];
}

export interface UnifiedBudget {
  type: string;
  id: number;
  number: string;
  workOrderNumber?: string;
  date: string;
  clientName?: string;
  clientPhone?: string;
  materials?: Array<{ name: string }>;
  items?: Array<{ detail: string; material?: string }>;
  material?: string;
  designObservations?: string;
  total: number;
  status: string;
}
