export interface PresupuestoOnlineItem {
  detalle: string;
  largo: number;
  ancho: number;
  m2: number;
  es_unidad: boolean;
  moneda: 'ARS' | 'USD';
  mano_de_obra: number;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  material: string;
  pileta_id: number | null;
  opcion: number;
}

export interface PresupuestoOnlinePayload {
  cliente: string;
  telefono: string;
  tipo_obra: string;
  fecha: string;
  dolar_dia: number;
  items: PresupuestoOnlineItem[];
  total_neto_ars: number;
  total_neto_usd: number;
  total_consolidado: number;
  pileta_id: number | null;
  pileta_precio: number;
  estado?: string;
}
