export const FORMAS_PAGO: string[] = ['Efectivo', 'Transferencia', 'Tarjeta'];
export const TIPOS_EGRESO: string[] = ['Gasto', 'Transferencia Banco'];

export const ESTADO_CARPETA_MAP: Record<string, string> = {
  'MEDICION': 'Medición',
  'TALLER': 'Taller',
  'TERMINADA': 'Terminada',
  'ENTREGADA': 'Entregada',
};

export const estadoCarpetaClass = (estado: string): string => {
  const map: Record<string, string> = {
    'Medición': 'badge-pending',
    'Taller': 'badge-production',
    'Terminada': 'badge-finished',
    'Entregada': 'badge-finished',
  };
  return map[estado] || 'badge-pending';
};
