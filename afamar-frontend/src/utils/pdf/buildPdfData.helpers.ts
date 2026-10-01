/**
 * Small pure helpers shared by the `buildPdfData` orchestrator and its
 * secondary builders.
 *
 * Kept dependency-free of the other PDF submodules so the layout builders
 * (sections / pieces) can reuse them without circular imports.
 */

import { round2 } from '../math';
import type { PaymentMethod } from '../../types/paymentMethod';
import type { DepositCurrency } from './buildPdfData.types';
import type { DocumentType } from './pdfTypes';

export interface PaidTotals {
  /** Seña expressed in ARS (USD seña × usd_rate when deposited in USD). */
  depositArsEquivalent: number;
  /** ARS acumulado abonado to show in the "Seña / Pagos Registrados" row. */
  paidArs: number;
  paidUsd: number;
  paidLabel: string;
}

export interface ComputePaidTotalsArgs {
  deposit: number;
  depositUsd: number;
  depositCurrency: DepositCurrency;
  usdRate: number;
  document_type: DocumentType;
  /** ARS acumulado abonado que WorkOrderFormPage pasa al preview — Paid +
   *  Saldo = TOTAL. Es el pago real del módulo (reconcilia el backend) o, si
   *  el módulo nunca registró pagos, el equivalente ARS de la seña del form.
   *  Nunca es la suma de ambos (el depósito autocompletado al total + pagos
   *  del módulo duplicaría la casilla). Cuando no llega (budgets / previews
   *  legacy) cae al equivalente ARS de la seña. */
  totalPaid?: number;
}

/**
 * Resolve the paid-totals block of the PDF payload. Passing the ARS
 * equivalent of the deposit (`deposit_usd × usd_rate` when the seña was paid
 * in USD) to `computeTotals` keeps `balance_due = total − deposit_ars`
 * correct regardless of the deposit's native currency. Mirrors the backend
 * fix in `WorkOrderService._recalculate_totals_from_items`.
 */
export function computePaidTotals({
  deposit,
  depositUsd,
  depositCurrency,
  usdRate,
  document_type,
  totalPaid,
}: ComputePaidTotalsArgs): PaidTotals {
  const depositArsEquivalent =
    depositCurrency === 'USD'
      ? usdRate > 0 ? depositUsd * usdRate : 0
      : deposit;
  // Pagos acumulados (ARS) — fuente de la fila "Seña / Pagos Registrados".
  // Para work orders `totalPaid` = seña del form + pagos del módulo de la
  // sesión, así el preview del PDF actualiza en vivo al registrar un pago y
  // el saldo se deriva de ahí (Paid + Saldo = TOTAL, igual que el builder
  // legacy en pdf_html.py).
  const paidArs = totalPaid !== undefined && totalPaid >= 0
    ? totalPaid
    : depositArsEquivalent;
  const paidUsd = usdRate > 0 ? round2(paidArs / usdRate) : 0;
  const paidLabel = document_type === 'work_order'
    ? 'Seña / Pagos Registrados'
    : 'Seña';
  return { depositArsEquivalent, paidArs, paidUsd, paidLabel };
}

/**
 * Resolve the catalogue row for the current payment method (same lookup as
 * `useBudgetCalculations.resolvePaymentMethod`): by `payment_method_id` FK
 * first, then by the `payment_method` name snapshot.
 */
export function resolvePaymentMethod(
  paymentMethods: PaymentMethod[],
  paymentMethodIdNum: number | null,
  paymentMethodRaw: string,
): PaymentMethod | null {
  if (paymentMethodIdNum) {
    const byId = paymentMethods.find((p) => p.id === paymentMethodIdNum);
    if (byId) return byId;
  }
  if (paymentMethodRaw) {
    const byName = paymentMethods.find((p) => p.name === paymentMethodRaw);
    if (byName) return byName;
  }
  return null;
}

/**
 * Active payment methods from the catalogue, printed as a reference box in
 * the PDF ("METODO DE PAGO") so the customer sees every option they can pay
 * with. Uppercase `name`s (stable snapshot keys, same convention as the
 * "Forma de pago:" row), ordered by the catalogue `sort_order`. For
 * percentage surcharges (credit card) the surcharge rate is appended
 * (e.g. "TARJETA DE CRÉDITO - 9% P/ CUOTA") so the customer knows how much
 * extra each installment costs before choosing.
 */
export function computePaymentMethodsCatalogue(paymentMethods: PaymentMethod[]): string[] {
  return paymentMethods
    .filter((p) => p.is_active !== false)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((p) => {
      if (p.type === 'SURCHARGE' && p.is_percentage && p.applies_to_installments && Number(p.value) > 0) {
        return `${p.name} - ${Number(p.value)}% P/ CUOTA`;
      }
      return p.name;
    });
}

/**
 * Sum the ACUMULADO de trabajos adicionales that is printed under the TOTAL
 * in the PDF footer (split by native currency). Mirrors the backend's
 * additional-works accumulation.
 */
export function computeAdditionalWorksSubtotals(additional_works: Array<{
  currency: 'ARS' | 'USD';
  subtotal_ars: number;
  subtotal_usd: number;
}>): { ars: number; usd: number } {
  const ars = additional_works
    .filter((a) => a.currency === 'ARS')
    .reduce((sum, a) => sum + a.subtotal_ars, 0);
  const usd = additional_works
    .filter((a) => a.currency === 'USD')
    .reduce((sum, a) => sum + a.subtotal_usd, 0);
  return { ars, usd };
}