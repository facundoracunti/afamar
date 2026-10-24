/**
 * PDF data types — SECCIÓN (per-material breakdown) domain.
 *
 * Extracted from `pdfTypes.ts` (which stays the public barrel). A section is
 * one self-contained quote block: the principal material or one alternative,
 * with its own materials / pools / fabrication / additional works and its own
 * subtotal.
 */

import type {
  AdditionalWorkPdfRow,
  MaterialPdfRow,
  PdfDataRow,
  PoolPdfRow,
} from './pdfTypes.material';

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
  // Per-option totals (optional). Populated when the budget has NO main
  // material, so every alternative page can show ITS OWN final price
  // instead of the document-level representative total.
  total_ars?: number;
  total_usd?: number;
  balance_due?: number;
  discount_fixed_amount?: number;
  surcharge_percentage?: number;
  surcharge_amount?: number;
  catalogue_installment_detail?: Array<{ cuota: number; interes: number; monto: number }>;
}
