// Work order payload — English snake_case field names matching backend API exactly.
// Source of truth: afamar-backend/app/schemas/work_order.py (WorkOrderBase / WorkOrderCreate / WorkOrderUpdate).

import type { FabricationDetail, MaterialInForm, PoolInForm } from './budget';

export interface ConvertOptionResponse {
  message: string;
  orderId: number;
  number: string;
}

export interface WorkOrderPayload {
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
  currency: string;
  usd_rate: number;
  subtotal: number;
  transport: number;
  total: number;
  subtotal_usd: number;
  transport_usd: number;
  total_usd: number;
  deposit_received: number;
  deposit_currency: string;
  deposit_usd: number;
  balance_due: number;
  balance_due_usd: number;
  payment_method: string | null;
  installments: number;
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
  discount_percentage: number;
  discount_fixed_amount: number;
  snapshot_name: string | null;
  snapshot_phone: string | null;
  snapshot_email: string | null;
  snapshot_address: string | null;
  date: string | null;
  status?: string;
}
