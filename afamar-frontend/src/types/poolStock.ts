export interface Pool {
  id: number;
  brand: string;
  model: string;
  description?: string;
  material?: string;
  quantity: number;
  price: number;
  currency: 'ARS' | 'USD';
  pool_type_id?: number | null;
  pool_type_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PoolType {
  id: number;
  name: string;
  label: string;
}

export interface WorkOrderPoolRequirement {
  id: number;
  work_order_id: number | null;
  work_order_number: string;
  pool_id: number | null;
  pool_key: string;
  pool_snapshot?: string | null;
  required_quantity: number;
  allocated_quantity: number;
  pending_quantity: number;
  recovered_quantity: number;
  unrecovered_quantity: number;
  status: string;
}

export interface PendingPoolRequirement {
  requirement_id: number;
  work_order_id: number;
  work_order_number: string;
  work_order_status: string;
  client_id: number;
  client_name: string;
  pool_id: number | null;
  pool_brand: string;
  pool_model: string;
  required_quantity: number;
  allocated_quantity: number;
  pending_quantity: number;
  available_quantity: number;
}

export interface PoolMovement {
  id: number;
  pool_id: number;
  /** English enum emitted by the backend: "entry" or "exit".
   *  The frontend passes this through `t()` (utils/translate.ts) to
   *  render the Spanish label in the history table. */
  type: string;
  quantity: number;
  /** Backend's `notes` column. May carry a `[WO:{id}]` prefix when the
   *  movement was auto-generated from a work order — the frontend
   *  parses that prefix to render a clickable link to the WO. */
  notes?: string | null;
  /** Kept for backward-compat with manual entries (the form used to
   *  send `description`, the API schema accepts `notes`; the page reads
   *  `notes ?? description` so both shapes work). */
  description?: string | null;
  created_at?: string;
}
