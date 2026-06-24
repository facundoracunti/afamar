export interface Cliente {
  id: number;
  nombre: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  observaciones?: string;
  created_at?: string;
  updated_at?: string;
  total_ordenes?: number;
  ultima_orden?: string;
}
