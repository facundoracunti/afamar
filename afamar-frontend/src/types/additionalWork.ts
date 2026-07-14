/** CRUD item for the `additional_works` catalogue. Wire format mirrors
 *  the backend Pydantic schema (currency is a string code; the service
 *  layer translates to `currency_id` FK on save).
 *
 *  `type` controls the pricing mode at budget save time:
 *    - `'flat'` (default): legacy `price * quantity` math.
 *    - `'frente'`: formula `(material.price_m2 * 0.13) * formula_constant`
 *      applied per linear meter supplied in the budget snapshot. */
export interface AdditionalWork {
  id: number;
  name: string;
  detail: string | null;
  price: number;
  currency: 'ARS' | 'USD';
  /** 'flat' (legacy `price * quantity` math) or 'frente'
   *  (formula `(material.price_m2 * 0.13) * formula_constant`,
   *  multiplied by `linear_meters` from the budget row). */
  type: 'flat' | 'frente';
  /** Multiplicador (default 1.15). Solo aplica a `frente`. DB column name
   *  sigue siendo `formula_constant` (no se renombró para evitar una
   *  migración adicional). */
  formula_constant: number | null;
  created_at?: string;
  updated_at?: string;
}

/** Catalogue picklist for the picker. */
export const ADDITIONAL_WORK_TYPES = ['flat', 'frente'] as const;
export type AdditionalWorkType = (typeof ADDITIONAL_WORK_TYPES)[number];
