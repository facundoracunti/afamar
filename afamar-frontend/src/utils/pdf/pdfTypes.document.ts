/**
 * PDF data types — DOCUMENTO domain.
 *
 * Extracted from `pdfTypes.ts` (which stays the public barrel). The root
 * payload handed to the renderer plus the params the builders receive.
 */

import type { PaymentMethod } from '../../types/paymentMethod';
import type { CompanyInfo, TermsInfo } from './pdfTypes.company';
import type {
  AdditionalWorkPdfRow,
  MaterialPdfRow,
  PdfDataRow,
  PoolPdfRow,
} from './pdfTypes.material';
import type { MeasurementComparisonRow } from './pdfTypes.measurement';
import type { OptionTotal } from './pdfTypes.options';
import type { PieceAlternativeTotal, PiecesPdfPiece } from './pdfTypes.piece';
import type { MaterialSection } from './pdfTypes.section';

export type DocumentType = 'budget' | 'work_order';

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
  /** COMPARATIVA DE MEDICIÓN rows (work orders only). Empty when the
   *  per-order flag `include_measurement_comparison_in_pdf` is false. */
  measurement_comparison: MeasurementComparisonRow[];
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
  /** USD value of the deposit when the customer paid it in USD
   *  (`deposit_currency === 'USD'`). Zero when the deposit is in ARS. */
  deposit_usd: number;
  /** Original currency of the seña. Drives which of `deposit_received` /
   *  `deposit_usd` is the native amount rendered in the Seña row. */
  deposit_currency: 'ARS' | 'USD';
  /** `deposit_received` (if ARS) or `deposit_usd × usd_rate` (if USD).
   *  Always expressed in ARS so the totals block can render both
   *  currencies side by side. */
  deposit_ars_equivalent: number;
  /** Acumulado abonado en ARS (seña + pagos del módulo de pagos). Fuente de
   *  la fila unificada "Seña / Pagos Registrados" y base del saldo derivado
   *  (Paid + Saldo = TOTAL). Para budgets coincide con
   *  `deposit_ars_equivalent`; para work orders refleja los INCOME movements
   *  del backend (o la seña del form + pagos de la sesión en el preview). */
  total_paid_ars: number;
  /** Equivalente USD del acumulado abonado (`total_paid_ars / usd_rate`). */
  total_paid_usd: number;
  /** Label de la fila de pago: `"Seña / Pagos Registrados"` for work
   *  orders, `"Seña"` for budgets. */
  paid_label: string;
  balance_due: number;
  total: number;
  total_usd: number;
  payment_method: string;
  /** Active payment methods from the catalogue (the `/admin/configuration/
   *  payment-methods` list), printed as a reference box in the PDF headers
   *  so the customer sees every accepted payment option. Uppercase `name`s
   *  (stable snapshot keys), ordered by `sort_order`. */
  payment_methods_catalogue: string[];
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
  /**
   * Multi-piece budgets only. When present (non-empty) the PDF renders the
   * two-page pieces layout (principal + alternatives sheet) instead of the
   * legacy "one page per option" sections. Absent for every legacy budget
   * and for work orders.
   */
  pieces?: PiecesPdfPiece[];
  /**
   * Multi-piece budgets only. One consolidated TOTAL GENERAL ALTERNATIVO
   * per alternative material, aggregated across every piece that quotes it
   * (see `PieceAlternativeTotal`). Rendered as highlighted summary blocks
   * at the end of the HOJA DE ALTERNATIVAS so the customer can compare the
   * real final price of choosing a material for the whole job. Absent for
   * budgets without pieces (legacy layout).
   */
  alternative_totals?: PieceAlternativeTotal[];
  /** Per-option totals for the "Resumen Comparativo de Opciones".
   *  Only populated when the budget has 2+ options (B1) — a legacy or
   *  single-option budget keeps the traditional Hoja de Alternativas and
   *  leaves this empty. */
  option_totals?: OptionTotal[];
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
  /** ARS acumulado abonado (seña del form + pagos del módulo de la sesión)
   *  que WorkOrderFormPage pasa al generar el preview del PDF: la fila
   *  "Seña / Pagos Registrados" muestra este monto y el saldo se deriva de
   *  él (Paid + Saldo = TOTAL). Omitido / 0 → usa el equivalente ARS de la
   *  seña (budgets y previews legacy, comportamiento sin cambio). */
  totalPaid?: number;
  /** Existing work orders use persisted commercial totals in the PDF. */
  usePersistedCommercialTotals?: boolean;
}
