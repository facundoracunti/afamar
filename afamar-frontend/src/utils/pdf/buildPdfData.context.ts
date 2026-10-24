/**
 * DOCUMENT CONTEXT — everything the PDF payload is built from.
 *
 * The context gathers the scenario's rows, runs the document rule set over
 * them and adds the COMPARATIVA DE MEDICIÓN + the payment-methods
 * catalogue.
 *
 * Split out of `buildPdfData.ts` (which stays the thin orchestrator) so
 * "compute the document numbers" and "shape the document object" are two
 * separate responsibilities:
 *
 *   - `buildPdfData.rows`      — the document's rows + subtotal
 *   - `buildPdfData.ruleSet`   — traslado / descuento / recargo / TOTAL
 *   - `buildPdfData.comparison`— COMPARATIVA DE MEDICIÓN
 */

import type { PaymentMethod } from '../../types/paymentMethod';
import { computePaymentMethodsCatalogue } from './buildPdfData.helpers';
import { collectDocumentRows, type DocumentRows } from './buildPdfData.rows';
import { computeDocumentRuleSet, type DocumentRuleSet } from './buildPdfData.ruleSet';
import { buildDocumentComparison } from './buildPdfData.comparison';
import type { DocumentType, MeasurementComparisonRow } from './pdfTypes';

/** Every value the document builder needs, already computed. */
export interface DocumentContextExtras {
  /** The form slice the document describes (winning option's pieces). */
  effectiveForm: Record<string, unknown>;
  measurement_comparison: MeasurementComparisonRow[];
  payment_methods_catalogue: string[];
}

export type DocumentContext = DocumentRows & DocumentRuleSet & DocumentContextExtras;

export interface DocumentContextParams {
  /** The ORIGINAL form (source of the scalar fields). */
  form: Record<string, unknown>;
  /** The scenario slice (winning option's pieces + re-flattened arrays). */
  effectiveForm: Record<string, unknown>;
  document_type: DocumentType;
  paymentMethods: PaymentMethod[];
  totalPaid?: number;
}

/**
 * Gather the document's rows and run the document rule set over them.
 */
export function buildDocumentContext({
  form,
  effectiveForm,
  document_type,
  paymentMethods,
  totalPaid,
}: DocumentContextParams): DocumentContext {
  const rows = collectDocumentRows({ form, effectiveForm, document_type });
  const ruleSet = computeDocumentRuleSet({
    form,
    rows,
    document_type,
    paymentMethods,
    totalPaid,
  });
  const measurement_comparison = buildDocumentComparison(
    form,
    effectiveForm,
    document_type,
    rows.usdRate,
  );

  // Active payment methods from the catalogue, printed as a reference box in
  // the PDF ("METODO DE PAGO") so the customer sees every option they can
  // pay with (uppercase `name`s, ordered by `sort_order`; percentage
  // surcharges append their per-cuota rate).
  const payment_methods_catalogue = computePaymentMethodsCatalogue(paymentMethods);

  return {
    ...rows,
    ...ruleSet,
    effectiveForm,
    measurement_comparison,
    payment_methods_catalogue,
  };
}
