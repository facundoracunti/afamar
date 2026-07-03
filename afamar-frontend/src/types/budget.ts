// Budget form schema types. Field names are in English snake_case to match the backend API exactly.
// Source of truth: afamar-backend/app/schemas/budget.py (BudgetBase / BudgetCreate / BudgetUpdate).

export interface FabricationDetail {
  // Spanish field names used inline in form state and fabrication_details array.
  // The backend serializes this array as a JSON string in fabrication_details TEXT column.
  concepto: string;
  detalle: string;
  concepto_personalizado?: string;
  material?: string;
  material_precio_m2?: number;
  largo: number | null;
  ancho: number | null;
  m2: number;
  mano_de_obra: number | null;
  moneda: 'ARS' | 'USD';
  cantidad: number;
  precio: number;
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
  priceM2?: number;
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

export interface PoolInForm {
  pool_id: number;
  brand: string;
  model: string;
  price: number;
  currency: 'ARS' | 'USD';
  image?: string;
  quantity: number;
}

export interface BudgetPayload {
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  client_address: string | null;
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
  balance_paid: boolean;
  balance_paid_at: string | null;
  payment_method: string | null;
  installments: number;
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
  discount_percentage: number;
  discount_fixed_amount: number;
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
