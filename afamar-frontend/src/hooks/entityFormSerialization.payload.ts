/**
 * FORM → API payload serialization.
 *
 * Split out of `entityFormSerialization.ts` (which stays the public
 * barrel) so the payload shape lives alone, next to the inverse mapping
 * (`entityFormSerialization.form.ts`).
 */

import type { EntityFormState } from '../types';
import { buildFinancialPayload } from './entityFormFinancial';
import { serializeSketchPages } from './entityForm/sketch';
import { jsonStringify, sliceDateToInput } from './entityFormSerialization.helpers';

/**
 * Build the API payload of the current form state.
 */
export function buildPayload(form: EntityFormState): Record<string, unknown> {
  return {
    client_name: form.client_name,
    client_phone: form.client_phone,
    client_address: form.client_address,
    client_email: form.client_email,
    delivery_address_id: form.delivery_address_id ? Number(form.delivery_address_id) : null,
    date: form.date ? sliceDateToInput(form.date) : null,
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
    delivery_date: form.delivery_date ? sliceDateToInput(form.delivery_date) : null,
    digital_signature: form.digital_signature,
    signed_at: form.signed_at ? sliceDateToInput(form.signed_at) : null,
    notes: form.notes,
    design_observations: form.design_observations,
    important_observations: form.important_observations,
    include_measurement_comparison_in_pdf: form.include_measurement_comparison_in_pdf === true,
    fabrication_details: jsonStringify(form.fabrication_details),
    pieces_data: jsonStringify(form.pieces),
    // Multi-option budgets (2026-10-01 Fase 2). NULL when the budget is
    // legacy single-option — the backend then synthesises one option from
    // `pieces_data`, so old and new rows share one code path.
    options_data: jsonStringify(
      (form.options ?? []).map((o) => ({
        id: o.id,
        name: o.name,
        is_selected: o.is_selected,
        pieces: o.pieces,
      })),
    ),
    materials_data: jsonStringify(form.materials_data),
    pools_data: jsonStringify(form.pools_data),
    sketch_elements: jsonStringify(serializeSketchPages(form.sketch_elements)),
    additional_works_data: form.additional_works_data || '[]',
    // Per-cuota breakdown computed by `useBudgetCalculations` (only set
    // when the active payment method is a credit-card percentage
    // surcharge). Serialised as JSON so the list-page PDF preview can
    // re-render the table even when the form hook isn't running.
    installment_detail_ars: form.installment_detail_ars
      ? JSON.stringify(form.installment_detail_ars)
      : null,
    installment_detail_usd: form.installment_detail_usd
      ? JSON.stringify(form.installment_detail_usd)
      : null,
  };
}
