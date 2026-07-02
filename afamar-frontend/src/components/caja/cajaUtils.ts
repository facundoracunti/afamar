export const FORMAS_PAGO: string[] = ['CASH', 'TRANSFER', 'CREDIT_CARD'];
export const TIPOS_EGRESO: string[] = ['GENERAL', 'BANK_TRANSFER'];

export const ESTADO_CARPETA_MAP: Record<string, string> = {
  'MEDICION': 'Medición',
  'TALLER': 'Taller',
  'TERMINADA': 'Terminada',
  'ENTREGADA': 'Entregada',
};

export const estadoCarpetaClass = (estado: string): string => {
  const map: Record<string, string> = {
    'MEASUREMENT': 'badge-pending',
    'WORKSHOP': 'badge-production',
    'FINISHED': 'badge-finished',
    'DELIVERED': 'badge-finished',
  };
  return map[estado] || 'badge-pending';
};
