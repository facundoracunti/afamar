// Work order payload — English snake_case field names matching backend API exactly.
// Source of truth: afamar-backend/app/schemas/work_order.py (WorkOrderBase / WorkOrderCreate / WorkOrderUpdate).

import type { FabricationDetail, MaterialInForm, PoolInForm } from './budget';
import type { FinancialBase } from './shared';

export interface ConvertOptionResponse {
  message: string;
  orderId: number;
  number: string;
}

export interface WorkOrderPayload extends FinancialBase {
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  client_address: string | null;
  /** Optional override — when the customer wants the work done at a
   *  non-default address (e.g. an architect with several project sites).
   *  `null` means "use the client's default address". */
  delivery_address_id: number | null;
  budget_id: number | null;
  material: string | null;
  material_price_m2: number;
  materials_data: string | null;
  color: string | null;
  thickness: string | null;
  finish: string | null;
  bacha: string | null;
  anafe: string | null;
  delivery_date: string | null;
  digital_signature: string | null;
  fabrication_details: string | null;
  budgeted_details: string | null;
  /** JSON-encoded array of sketch elements (matches the wire format the
   *  budget/measurement use). Populated from the source budget on
   *  conversion. When the user edits the WO, the editor mutates this list
   *  and we re-serialise via `flattenSketchElements` in `buildPayload`. */
  sketch_elements: string | null;
  pool_id: number | null;
  pool_price: number;
  pool_currency: string;
  pool_image: string | null;
  pools_data: string | null;
  adicionales_data: string | null;
  design_observations: string | null;
  important_observations: string | null;
  notes: string | null;
  date: string | null;
  status?: string;
}

/**
 * Trimmed shape returned by GET /work-orders (list). The backend populates
 * client_name/phone/email/address from the related Client row.
 */
export interface WorkOrderListItem {
  id: number;
  number: string;
  status: string;
  origin?: string;
  client_id?: number | null;
  budget_id?: number | null;

  // Client
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  client_address: string | null;

  // Material
  material: string | null;

  // Money (FinancialBase sub set)
  currency: string;
  total: number;
  total_usd?: number;
  deposit_received: number;
  balance_due: number;

  // Dates
  delivery_date: string | null;
  date?: string | null;
  created_at?: string;
}