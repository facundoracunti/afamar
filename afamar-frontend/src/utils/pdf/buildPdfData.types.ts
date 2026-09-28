/**
 * Shared types for the PDF data builders (`buildPdfData` and its secondary
 * modules).
 *
 * These shapes were previously declared inline inside `buildPdfData.ts`;
 * they only describe the inputs/outputs of the totals engine (`computeTotals`)
 * and the consolidated alternative blocks (`buildAlternativeTotals`). The
 * rendered document shape lives in `./pdfTypes`.
 */

import type { PaymentMethod } from '../../types/paymentMethod';

/** Native currency of a deposit / seña. */
export type DepositCurrency = 'ARS' | 'USD';

/** One row of the credit-card per-cuota breakdown (3-column table). */
export interface InstallmentDetailRow {
  cuota: number;
  interes: number;
  monto: number;
}

/**
 * Shared "document rule set" inputs passed to every `computeTotals` consumer
 * (document-level totals, per-option section totals and the consolidated
 * alternative totals). Bundled so the orchestrator can forward the same
 * context to each block builder without repeating the 12 fields.
 */
export interface TotalsContext {
  transport: number;
  transportUsd: number;
  discountPct: number;
  discountFixedRaw: number;
  usdRate: number;
  pm: PaymentMethod | null;
  installments: number;
  deposit: number;
  /** Fase 3 — Descuento Comercial. `null` keeps the legacy behavior (a
   *  percentage applies whenever `discountPct > 0`); a boolean gates it, so
   *  the toggle OFF means the % never applies. */
  discountEnabled?: boolean | null;
  /** Base for the commercial percentage discount: 'total' = whole document
   *  (materials + fabrication + alternatives + pools + additional), or
   *  'materials' = only the main materials' subtotal. */
  discountTarget?: 'total' | 'materials';
  materialsSubtotalArs?: number;
  materialsSubtotalUsd?: number;
}

/** Inputs of `computeTotals`: the subtotal to value + the rule set. */
export interface ComputeTotalsParams extends TotalsContext {
  subtotalArs: number;
  subtotalUsd: number;
}

/** Aggregated totals breakdown returned by `computeTotals`. */
export interface ComputeTotalsResult {
  subtotal: number;
  discount_fixed_amount: number;
  surcharge_percentage: number;
  surcharge_amount: number;
  catalogue_surcharge_percentage: number;
  catalogue_surcharge_amount: number;
  catalogue_discount_percentage: number;
  catalogue_discount_amount: number;
  catalogue_method_label: string;
  catalogue_installment_detail: InstallmentDetailRow[];
  total: number;
  total_usd: number;
  balance_due: number;
}

/**
 * Inputs of `buildAlternativeTotals`: the document rule set WITHOUT the
 * per-material subtotal inputs (`materialsSubtotalArs` / `materialsSubtotalUsd`)
 * — the alternative consolidation reuses the same discount/surcharge rule set
 * but never runs a materials-only base.
 */
export interface BuildAlternativeTotalsParams {
  transport: number;
  transportUsd: number;
  discountPct: number;
  discountFixedRaw: number;
  usdRate: number;
  pm: PaymentMethod | null;
  installments: number;
  deposit: number;
  discountEnabled?: boolean | null;
  discountTarget?: 'total' | 'materials';
}