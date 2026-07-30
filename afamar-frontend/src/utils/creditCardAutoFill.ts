/**
 * Credit/debit card payment auto-fill.
 *
 * When the operator picks "Tarjeta de crédito" or "Tarjeta de débito" as
 * the payment method, the deposit + balance fields are pre-filled to a
 * fully-paid state:
 *   - deposit_received = total
 *   - balance_due      = 0
 *   - balance_paid     = true
 *   - deposit_usd      = total_usd
 *   - balance_due_usd  = 0
 *   - balance_paid_at   = today
 *
 * The helper mutates the passed object in place (the form payload lives
 * in the BudgetForm / WorkOrderForm save flow where objects are passed
 * by reference). Returned for convenience.
 *
 * Returns `true` if the auto-fill was applied, `false` if the payment
 * method doesn't match — so callers can branch.
 */

const CARD_METHODS = ['TARJETA DE CRÉDITO', 'TARJETA DE DÉBITO'] as const;

export function isCardPaymentMethod(method: string | null | undefined): boolean {
  return !!method && (CARD_METHODS as readonly string[]).includes(method);
}

export interface CardAutoFillTarget {
  deposit_received?: number;
  balance_due?: number;
  balance_paid?: boolean;
  deposit_usd?: number;
  balance_due_usd?: number;
  balance_paid_at?: string;
}

export function applyCreditCardAutoFill<T extends CardAutoFillTarget>(
  target: T,
  paymentMethod: string | null | undefined,
  total: number,
  totalUsd: number,
  today: string,
): boolean {
  if (!isCardPaymentMethod(paymentMethod)) return false;
  target.deposit_received = Number(total) || 0;
  target.balance_due = 0;
  target.balance_paid = true;
  target.deposit_usd = Number(totalUsd) || 0;
  target.balance_due_usd = 0;
  target.balance_paid_at = today;
  return true;
}