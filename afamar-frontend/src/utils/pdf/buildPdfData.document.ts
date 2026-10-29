/**
 * The BASE document object handed to the `<DocumentPdf/>` renderer.
 *
 * Split out of `buildPdfData.ts` (which stays the thin orchestrator) so
 * "shape the document payload" is one responsibility and "compute the
 * numbers" is another (`buildPdfData.context.ts`).
 */

import { formatDate, splitTerms } from './pdfHelpers';
import { formNum, formStr } from './buildPdfData.form';
import type { DocumentContext } from './buildPdfData.context';
import type {
  BuildPdfDataParams,
  CompanyInfo,
  DocumentType,
  PdfDocumentData,
  TermsInfo,
} from './pdfTypes';

/** The document's own metadata (everything read straight from the form). */
export interface DocumentMeta {
  form: Record<string, unknown>;
  document_type: DocumentType;
  overrides?: BuildPdfDataParams['overrides'];
  company: CompanyInfo;
  globalTerms: TermsInfo;
  sketchImages: string[];
}

/**
 * Build the canonical PDF data object from the computed document context.
 */
export function buildBaseDocument(
  ctx: DocumentContext,
  meta: DocumentMeta,
): PdfDocumentData {
  const { form, document_type, overrides, company, globalTerms, sketchImages } = meta;
  const str = (k: string): string => formStr(form, k);
  const num = (k: string): number => formNum(form, k);

  return {
    document_type,
    title: document_type === 'budget' ? 'PRESUPUESTO' : 'ORDEN DE TRABAJO',
    number: str('number'),
    doc_sub: '',
    date: formatDate(form.date),
    client_name: str('client_name'),
    client_phone: str('client_phone'),
    client_address: str('client_address'),
    client_email: str('client_email'),
    material_color: str('color'),
    material_thickness: str('thickness'),
    material_finish: str('finish'),
    delivery_date: form.delivery_date ? formatDate(form.delivery_date) : '',
    sections: ctx.sections,
    fabrication_details: ctx.flatFabrication,
    materials: ctx.flatMaterials,
    pools: ctx.flatPools,
    measurement_comparison: ctx.measurement_comparison,
    measurement_note: ctx.measurement_note,
    subtotal: ctx.computedSubtotal,
    transport: ctx.transport,
    discount_percentage: num('discount_percentage'),
    discount_fixed_amount: ctx.discountFixed,
    surcharge_percentage: ctx.surchargePct,
    surcharge_amount: ctx.surchargeAmount,
    catalogue_surcharge_percentage: ctx.catalogueSurchargePct,
    catalogue_surcharge_amount: ctx.catalogueSurchargeAmount,
    catalogue_discount_percentage: ctx.catalogueDiscountPct,
    catalogue_discount_amount: ctx.catalogueDiscountAmount,
    catalogue_method_label: ctx.catalogueMethodLabel,
    catalogue_installments: ctx.installmentsNum,
    catalogue_installment_detail: ctx.catalogueInstallmentDetail,
    deposit_received: ctx.deposit,
    deposit_usd: ctx.depositUsd,
    deposit_currency: ctx.depositCurrency,
    deposit_ars_equivalent: ctx.depositArsEquivalent,
    total_paid_ars: ctx.paidArs,
    total_paid_usd: ctx.paidUsd,
    paid_label: ctx.paidLabel,
    balance_due: ctx.computedBalanceDue,
    total: ctx.computedTotal,
    total_usd: ctx.computedTotalUsd,
    payment_method: str('payment_method'),
    payment_methods_catalogue: ctx.payment_methods_catalogue,
    installments: num('installments') || 1,
    notes: str('notes'),
    important_observations: str('important_observations'),
    important_observations_list: splitTerms(form.important_observations),
    budget_terms_list: [],
    delivery_terms_list: overrides?.delivery_terms && overrides.delivery_terms.length > 0
      ? overrides.delivery_terms
      : globalTerms.delivery_terms,
    warranty_terms_list: overrides?.warranty_terms && overrides.warranty_terms.length > 0
      ? overrides.warranty_terms
      : globalTerms.warranty_text,
    sketch_images: sketchImages,
    usd_rate: ctx.usdRate,
    usd_rate_fetched_at: str('usd_rate_fetched_at') || null,
    company,
    additional_works: ctx.additional_works,
    additional_works_subtotal_ars: ctx.additionalWorksSubtotalArs,
    additional_works_subtotal_usd: ctx.additionalWorksSubtotalUsd,
  };
}
