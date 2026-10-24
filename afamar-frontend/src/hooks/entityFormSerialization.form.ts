/**
 * API → FORM mapping.
 *
 * Split out of `entityFormSerialization.ts` (which stays the public
 * barrel) so the inverse of `buildPayload` lives alone.
 */

import type { EntityFormState } from '../types';
import { todayLocalISO } from '../utils/formatters';
import { INITIAL_FORM } from './entityFormConstants';
import { mapFinancialToForm } from './entityFormFinancial';
import { unflattenSketchElements } from './entityForm/sketch';
import { loadOptions } from './entityFormSerialization.options';
import { loadPieces } from './entityFormSerialization.pieces';
import { jsonParseList, sliceDateToInput } from './entityFormSerialization.helpers';

/**
 * Map an API row into the form state the editors consume.
 */
export function mapApiToForm(d: Record<string, unknown>, defaultStatus: string): EntityFormState {
  return {
    ...INITIAL_FORM,
    ...mapFinancialToForm(d),
    client_name: (d.client_name as string) || '',
    client_phone: (d.client_phone as string) || '',
    client_address: (d.client_address as string) || '',
    client_email: (d.client_email as string) || '',
    delivery_address_id: (d.delivery_address_id as number | null) ?? null,
    // Origin marker — only meaningful for work orders. Set to the id of
    // the budget this order was converted from; null for direct work
    // orders created manually. Drives the COMPARATIVA DE MEDICIÓN gate:
    // only work orders with a `budget_id` show the comparison toggle in
    // the form (direct orders skip it).
    budget_id: (d.budget_id as number | null) ?? null,
    number: (d.number as string) || (d.numero as string) || '',
    date: sliceDateToInput(d.date) || todayLocalISO(),
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
    balance_paid: (d.balance_paid as boolean) || false,
    balance_paid_at: sliceDateToInput(d.balance_paid_at) || '',
    delivery_date: sliceDateToInput(d.delivery_date) || '',
    digital_signature: (d.digital_signature as string) || null,
    signed_at: sliceDateToInput(d.signed_at) || '',
    notes: (d.notes as string) || '',
    design_observations: (d.design_observations as string) || '',
    important_observations: (d.important_observations as string) || '',
    include_measurement_comparison_in_pdf: (d.include_measurement_comparison_in_pdf as boolean) ?? false,
    fabrication_details: jsonParseList(d.fabrication_details) as EntityFormState['fabrication_details'],
    // Pieces v3: pieces-only mode is the ONLY mode. The pieces + their
    // derived flat columns are computed ONCE (see `loadPieces`) so
    // the legacy migration runs once and the flat arrays are guaranteed
    // to match the pieces (no drift between `pools_data` and `piece.pools`,
    // which was a bug in the previous duplicated-IIFE implementation).
    ...loadOptions(d, loadPieces(d).pieces),
    materials_data: jsonParseList(d.materials_data) as EntityFormState['materials_data'],
    sketch_elements: unflattenSketchElements(d.sketch_elements) as unknown[],
    additional_works_data: (d.additional_works_data as string | null) ?? null,
    // Per-cuota breakdown persisted by the backend. Empty list when
    // the active method isn't a credit-card percentage surcharge.
    installment_detail_ars: jsonParseList(d.installment_detail_ars) as EntityFormState['installment_detail_ars'],
    installment_detail_usd: jsonParseList(d.installment_detail_usd) as EntityFormState['installment_detail_usd'],
  };
}
