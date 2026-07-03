export const PAYMENT_METHODS: string[] = ['CASH', 'TRANSFER', 'CREDIT_CARD'];
export const EXPENSE_TYPES: string[] = ['GENERAL', 'BANK_TRANSFER'];

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
