/**
 * Payment-method catalogue entry.
 *
 * Each row drives both the form's "Forma de pago" `<select>` and the
 * live total calculation (discount / surcharge). The DB is the single
 * source of truth — the frontend never hardcodes rules per method.
 */
export type PaymentMethodType = 'DISCOUNT' | 'SURCHARGE' | 'NONE';

export interface PaymentMethod {
  id: number;
  name: string;
  label: string;
  color: string | null;
  is_active: boolean;
  sort_order: number;
  /** Direction of the value: DISCOUNT reduces the total, SURCHARGE adds to it. */
  type: PaymentMethodType;
  /** Raw amount (percentage points or fixed ARS — see `is_percentage`). */
  value: number;
  /** When `true`, `value` is interpreted as a percentage; otherwise as a fixed ARS amount. */
  is_percentage: boolean;
  /**
   * When `true`, the catalogue's `value` is scaled by the installment
   * count (legacy credit-card rule: N * 5% for N >= 3). The live form
   * honours the persisted value as-is; this flag is metadata for the
   * "Tipo" hint in the catalogue UI.
   */
  applies_to_installments: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PaymentMethodCreate {
  name: string;
  label: string;
  color?: string | null;
  is_active?: boolean;
  sort_order?: number;
  type?: PaymentMethodType;
  value?: number;
  is_percentage?: boolean;
  applies_to_installments?: boolean;
}

export interface PaymentMethodUpdate {
  name?: string;
  label?: string;
  color?: string | null;
  is_active?: boolean;
  sort_order?: number;
  type?: PaymentMethodType;
  value?: number;
  is_percentage?: boolean;
  applies_to_installments?: boolean;
}
