// Online budget schema. Field names kept in Spanish to match the
// form layer (OnlineItemsTable.tsx, OnlineBudgetFormPage.tsx).

export interface OnlineBudgetItem {
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

export interface OnlineBudgetPayload {
  cliente: string;
  telefono: string;
  tipo_obra: string;
  fecha: string;
  dolar_dia: number;
  items: OnlineBudgetItem[];
  total_neto_ars: number;
  total_neto_usd: number;
  total_consolidado: number;
  pileta_id: number | null;
  pileta_precio: number;
  estado?: string;
}
