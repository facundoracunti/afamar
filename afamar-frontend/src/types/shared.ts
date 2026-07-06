// Shared base interfaces reused across entity types.
//
// FinancialBase holds the 17 monetary / payment fields that are bit-for-bit
// identical between `EntityFormState` (form-local state), `BudgetPayload` and
// `WorkOrderPayload` (both wire formats to the FastAPI backend). Types match
// the **stricter** payload shape (no `undefined`, `string | null` allowed for
// optional payment_method) so an `EntityFormState extends FinancialBase`
// relation type-checks unchanged. See `PLAN.md` §#5.
export interface FinancialBase {
  // Currency of the *totals* (ARS / USD). Per-pool / per-material currencies
  // are stored in `MaterialInForm.currency` / `PoolInForm.currency`.
  currency: string;
  usd_rate: number;

  // Totals (in the currency of `currency`).
  subtotal: number;
  transport: number;
  total: number;

  // Totals (mirror of the above in USD, computed from `usd_rate`).
  subtotal_usd: number;
  transport_usd: number;
  total_usd: number;

  // Deposit / down-payment.
  deposit_received: number;
  deposit_currency: string;
  deposit_usd: number;

  // Outstanding balance (= total - deposit_received).
  balance_due: number;
  balance_due_usd: number;

  // Payment terms.
  payment_method: string | null;
  installments: number;

  // Commercial discount (mutually exclusive: percentage OR fixed amount).
  discount_percentage: number;
  discount_fixed_amount: number;
}
