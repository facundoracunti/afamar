/**
 * Constants and initial form state for the entity form.
 */

import type { EntityFormState } from '../types';
import type { FinancialBase } from '../types/shared';
import { fabricationConcepts } from '../utils/formatters';

export const M2_CONCEPTS: string[] = fabricationConcepts.filter((c) =>
  c === 'BASEBOARD' || c === 'FRONT'
);

export const CUTOUT_DETAILS: Record<string, string> = {
  CUTOUT_SINK: 'Apertura y pegado de pileta',
  CUTOUT_COOKTOP: 'Apertura de anafe',
  CUTOUT_DROPIN_SINK: 'Apertura pileta de apoyo',
};

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

export const INITIAL_FORM: EntityFormState = {
  client_name: '',
  client_phone: '',
  client_address: '',
  client_email: '',
  delivery_address_id: null,
  number: '',
  date: '',
  status: '',
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
  ...DEFAULT_FINANCIALS,
  balance_paid: false,
  balance_paid_at: '',
  delivery_date: '',
  digital_signature: null,
  signed_at: '',
  notes: '',
  design_observations: '',
  important_observations: '',
  fabrication_details: [],
  materials_data: [],
  pools_data: [],
  sketch_elements: [],
  additional_works_data: null,
  work_order_number: null,
  budget_terms: [],
  warranty_terms: [],
  delivery_terms: [],
};
