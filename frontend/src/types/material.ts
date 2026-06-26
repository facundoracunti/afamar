export interface Material {
  id: number;
  nombre: string;
  categoria?: string;
  color?: string;
  espesor_disponible?: string;
  precio_m2: number;
  precio_m2_usd: number;
  moneda: 'ARS' | 'USD';
  proveedor?: string;
  stock_disponible?: number;
  foto?: string;
  observaciones?: string;
  created_at?: string;
}

export interface MaterialFormData {
  nombre: string;
  categoria: string;
  color: string;
  espesor_disponible: string;
  precio_m2: number;
  precio_m2_usd: number;
  moneda: 'ARS' | 'USD';
  proveedor: string;
  stock_disponible: number;
  observaciones: string;
}
