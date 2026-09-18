/**
 * Fase 3 — Descuento Comercial (commercial discount), frontend-only.
 *
 * The selector UI + calculation live in the budgets feature
 * `@features/budgets`, but the state rides on `EntityFormState` via
 * `FinancialBase` (shared with work orders because both share
 * `useBudgetCalculations`). The percentage reuses the pre-existing
 * `discount_percentage` field (which already persists through the API);
 * `discount_enabled` / `discount_target` / `discount_amount` are sent in the
 * payload but ignored by the backend until a future phase.
 */

/** Base the percentage runs against. */
export type DiscountTarget = 'total' | 'materials';

export interface CommercialDiscountState {
  discount_enabled: boolean;
  discount_percentage: number;
  discount_target: DiscountTarget;
  discount_amount: number;
}

/** Visible labels (UI always in Spanish). */
export const DISCOUNT_TARGET_LABELS: Record<DiscountTarget, string> = {
  total: 'Total General',
  materials: 'Solo Materiales',
};