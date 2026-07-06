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
  pool_id: number | null;
  pool_price: number;
  pool_currency: string;
  pool_image: string | null;
  pools_data: string | null;
  adicionales_data: string | null;
  design_observations: string | null;
  important_observations: string | null;
  notes: string | null;
  snapshot_name: string | null;
  snapshot_phone: string | null;
  snapshot_email: string | null;
  snapshot_address: string | null;
  date: string | null;
  status?: string;
}

/**
 * Trimmed shape returned by GET /work-orders (list). The backend now
 * populates client_name/phone/email/address from the snapshot via
 * WorkOrderResponse.from_orm_with_snapshot, so the frontend no longer needs
 * to fall back to a Client cache.
 */
export interface WorkOrderListItem {
  id: number;
  number: string;
  status: string;
  origin?: string;
  budget_id?: number | null;

  // Client snapshot
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  client_address: string | null;
  snapshot_name?: string | null;
  snapshot_phone?: string | null;

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
