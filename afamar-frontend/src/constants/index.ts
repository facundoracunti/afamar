export const PAYMENT_METHODS: string[] = ['CASH', 'TRANSFER', 'CREDIT_CARD'];
export const EXPENSE_TYPES: string[] = ['GENERAL', 'BANK_TRANSFER'];

/**
 * Literal payment-method values emitted by the form (Spanish, as
 * stored in the DB). Kept here so the PDF renderer can branch on them
 * without hardcoding strings in the JSX.
 */
export const PAYMENT_METHOD_TRANSFER = 'TRANSFERENCIA BANCARIA';

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
