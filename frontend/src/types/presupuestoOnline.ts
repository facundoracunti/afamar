export interface PresupuestoOnlineItem {
  detalle: string;
  largo?: number;
  ancho?: number;
  m2?: number;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  moneda: 'ARS' | 'USD';
  tipo: string;
  material?: string;
  mano_de_obra?: number;
}

export interface PresupuestoOnlinePayload {
  cliente: string;
  tipo_obra: string;
  fecha: string | null;
  items: PresupuestoOnlineItem[];
  dolar_dia: number;
  total_neto_ars: number;
  total_neto_usd: number;
  total_consolidado: number;
  estado?: string;
}
