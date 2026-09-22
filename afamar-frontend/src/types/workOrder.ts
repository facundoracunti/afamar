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
  /** JSON-encoded array of sketch PAGES (wire format
   *  `[{ pagina_id, name, material?, dibujo: [...] }]`) — the page shape is
   *  what WorkOrders persist so the FICHA DE TALLER can render a per-page
   *  name/material label. Populated from the source budget on conversion
   *  (legacy flat lists) or from the editor. When the user edits the WO,
   *  the editor mutates this list and we re-serialise via
   *  `serializeSketchPages` in `buildPayload`. */
  sketch_elements: string | null;
  pool_id: number | null;
  pool_price: number;
  pool_currency: string;
  pool_image: string | null;
  pools_data: string | null;
  additional_works_data: string | null;
  design_observations: string | null;
  important_observations: string | null;
  notes: string | null;
  date: string | null;
  status?: string;
}

/**
 * Trimmed shape returned by GET /work-orders (list). The backend populates
 * client_name/phone/email/address from the related Client row.
 *
 * Multi-piece v3: the list response carries BOTH the legacy flat
 * `material` column AND `materials_data` (JSON string) so the table
 * can render the principal name even when the legacy column was
 * cleared during piece-driven editing.
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

  // Material — multiple sources, table picks the first non-empty:
  material: string | null;
  /** Parsed JSON array of multi-piece materials (v3 source of truth).
   *  Each entry is `{ name, length, width, quantity, price_m2, ... }`. */
  materials_data?: string | null;
  /** Parsed JSON array of pieces. Each piece carries
   *  `mainMaterial: { name, ... }` + `alternativeMaterials[]`. */
  pieces?: unknown[] | null;
  /** Legacy field (very old list responses). Treat as `material`. */
  items?: unknown[] | null;
  estimated_delivery_date?: string | null;

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