export const PAYMENT_METHODS: string[] = ['CASH', 'TRANSFER', 'CREDIT_CARD'];
export const EXPENSE_TYPES: string[] = ['GENERAL', 'BANK_TRANSFER'];

/**
 * Literal payment-method values emitted by the form (Spanish, as
 * stored in the DB). Kept here so the PDF renderer can branch on them
 * without hardcoding strings in the JSX.
 */
export const PAYMENT_METHOD_TRANSFER = 'TRANSFERENCIA BANCARIA';

/**
 * Payment method label that triggers installment surcharges. The form
 * also uses this string to decide whether to apply the surcharge table
 * below, so the PDF renderer and the form stay in sync.
 */
export const PAYMENT_METHOD_CREDIT_CARD = 'TARJETA DE CRÉDITO';

/**
 * Surcharge percentage applied to the discounted total when the customer
 * picks "Tarjeta de crédito" with N installments.
 *
 * Formula: `i <= 2 ? 0 : i * 5` (cuota 1 y 2 → sin recargo; cuota N → N * 5%).
 *  - 1 cuota  → 0%   (sin recargo)
 *  - 2 cuotas → 0%   (sin recargo)
 *  - 3 cuotas → 15%
 *  - 4 cuotas → 20%
 *  - 5 cuotas → 25%
 *  - 6 cuotas → 30%
 *  - ...
 *  - 12 cuotas → 60%
 *
 * Single source of truth shared between `useBudgetCalculations` (where
 * the surcharge is added to the form's `total`) and `buildPdfData`
 * (where the PDF renders the breakdown as a "Recargo" line). If the
 * company ever changes its surcharge policy, update this constant
 * only and both code paths follow.
 */
export const INSTALLMENT_SURCHARGE_PERCENTAGE: Record<number, number> = {};
for (let i = 1; i <= 12; i += 1) {
  INSTALLMENT_SURCHARGE_PERCENTAGE[i] = i <= 2 ? 0 : i * 5;
}

export const FOLDER_STATUS_MAP: Record<string, string> = {
  'MEDICION': 'Medición',
  'TALLER': 'Taller',
  'TERMINADA': 'Terminada',
  'ENTREGADA': 'Entregada',
};

export const folderStatusClass = (estado: string): string => {
  const map: Record<string, string> = {
    'MEASUREMENT': 'badge-pending',
    'WORKSHOP': 'badge-production',
    'FINISHED': 'badge-finished',
    'DELIVERED': 'badge-finished',
  };
  return map[estado] || 'badge-pending';
};

/**
 * Bank account details printed on the PDF when the customer picks the
 * "Transferencia Bancaria" payment method. Single source of truth — if
 * the company ever changes its alias or bank, update this constant.
 */
export const BANK_INFO = {
  alias: 'afamar',
  banco: 'CREDICOOP',
  titular: 'afamar SRL',
} as const;

export const SKETCH_STAGE_WIDTH = 1480;
export const SKETCH_STAGE_HEIGHT = 600;
