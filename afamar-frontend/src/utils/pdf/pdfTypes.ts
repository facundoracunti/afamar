/**
 * PDF data types shared between build helpers and DocumentPdf renderer.
 */

import type { MaterialInForm, PoolInForm } from '../../types/budget';
import type { PaymentMethod } from '../../types/paymentMethod';

export type DocumentType = 'budget' | 'work_order';

export interface PdfDataRow {
  readonly concept: string;
  readonly detail: string;
  readonly material: string;
  readonly show_length: boolean;
  readonly show_width: boolean;
  readonly show_m2: boolean;
  readonly show_quantity: boolean;
  readonly length_str: string | null;
  readonly width_str: string | null;
  readonly m2_label: string | null;
  readonly quantity: number;
  readonly currency: 'ARS' | 'USD';
  readonly price_str: string;
  readonly labor_str: string | null;
  readonly subtotal_ars: number;
  readonly subtotal_usd: number;
}

export interface MaterialPdfRow {
  readonly name: string;
  readonly color: string;
  readonly length_str: string;
  readonly width_str: string;
  readonly quantity: number;
  readonly m2_str: string;
  readonly price_m2_str: string;
  readonly subtotal_str: string;
  readonly currency: 'ARS' | 'USD';
  readonly subtotal_ars: number;
  readonly subtotal_usd: number;
}

export interface PoolPdfRow {
  readonly brand: string;
  readonly model: string;
  readonly quantity: number;
  readonly price_str: string;
  readonly subtotal_str: string;
  readonly currency: 'ARS' | 'USD';
  readonly subtotal_ars: number;
  readonly subtotal_usd: number;
  readonly material: string;
}

export interface AdditionalWorkPdfRow {
  readonly name: string;
  readonly detail: string | null;
  readonly currency: 'ARS' | 'USD';
  readonly price_str: string;
  readonly quantity: number;
  readonly subtotal_ars: number;
  readonly subtotal_usd: number;
  readonly type?: 'flat' | 'frente';
  readonly linear_meters_str?: string | null;
  readonly material_price_per_m2_str?: string | null;
  readonly formula_constant_str?: string | null;
  readonly material_name?: string;
}

export interface CompanyInfo {
  company_name: string;
  company_tagline: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_logo: string;
  pdf_footer: string;
}

export interface TermsInfo {
  budget_terms: string[];
  delivery_terms: string[];
  warranty_text: string[];
}

export interface MaterialSection {
  title: string;
  is_main: boolean;
  is_global: boolean;
  alternative_index?: number;
  material_name: string;
  materials: MaterialPdfRow[];
  pools: PoolPdfRow[];
  fabrication_details: PdfDataRow[];
  additional_works: AdditionalWorkPdfRow[];
  subtotal_ars: number;
  subtotal_usd: number;
}

export interface PdfDocumentData {
  document_type: DocumentType;
  title: string;
  number: string;
  doc_sub: string;
  date: string;
  client_name: string;
  client_phone: string;
  client_address: string;
  client_email: string;
  material_color: string;
  material_thickness: string;
  material_finish: string;
  delivery_date: string;
  sections: MaterialSection[];
  fabrication_details: PdfDataRow[];
  materials: MaterialPdfRow[];
  pools: PoolPdfRow[];
  additional_works: AdditionalWorkPdfRow[];
  additional_works_subtotal_ars: number;
  additional_works_subtotal_usd: number;
  subtotal: number;
  transport: number;
  discount_percentage: number;
  discount_fixed_amount: number;
  /** Legacy surcharge fields — kept for backward compat with
   *  `DocumentPdf.tsx` and the buildPdfData tests that already
   *  reference them. Same value as `catalogue_surcharge_*` for
   *  the form-driven SURCHARGE row. */
  surcharge_percentage: number;
  surcharge_amount: number;
  /** Catalogue-driven surcharge (from the `payment_methods` row the
   *  form selected). When the selected method is `DISCOUNT`,
   *  `catalogue_discount_*` holds the breakdown instead. */
  catalogue_surcharge_percentage: number;
  catalogue_surcharge_amount: number;
  catalogue_discount_percentage: number;
  catalogue_discount_amount: number;
  catalogue_method_label: string;
  catalogue_installments: number;
  /**
   * Per-cuota breakdown (3-column table next to the recargo) for
   * credit-card percentage surcharges. Empty for every other shape.
   * Mirrors the backend shape from `_recalculate_totals_from_items` →
   * `installment_detail_ars` / `installment_detail_usd`.
   */
  catalogue_installment_detail: Array<{ cuota: number; interes: number; monto: number }>;
  deposit_received: number;
  balance_due: number;
  total: number;
  total_usd: number;
  payment_method: string;
  installments: number;
  notes: string;
  important_observations: string;
  important_observations_list: string[];
  budget_terms_list: string[];
  delivery_terms_list: string[];
  warranty_terms_list: string[];
  sketch_images: string[];
  /** USD venta rate frozen on the document at save time. Printed in
   *  the totals block as "Dólar del día: $X.XXX" so the customer has a
   *  paper trail of the conversion rate they were quoted. */
  usd_rate: number;
  /** ISO timestamp of when the USD rate was fetched. Shown next to the
   *  rate so the operator / customer can see how stale the quote is. */
  usd_rate_fetched_at: string | null;
  company: CompanyInfo;
}

export interface BuildPdfDataParams {
  form: Record<string, unknown>;
  document_type: DocumentType;
  overrides?: {
    budget_terms?: string[];
    delivery_terms?: string[];
    warranty_terms?: string[];
  };
  company: CompanyInfo;
  globalTerms: TermsInfo;
  sketchImages?: string[];
  /** Active payment methods from the catalogue. Used to resolve the
   *  `payment_method_id` / `payment_method` snapshot into a `type` /
   *  `value` / `is_percentage` / `applies_to_installments` rule for
   *  the live PDF total (mirrors `useBudgetCalculations`). Optional —
   *  the PDF falls back to no surcharge if not provided. */
  paymentMethods?: PaymentMethod[];
}

export type { MaterialInForm, PoolInForm };
