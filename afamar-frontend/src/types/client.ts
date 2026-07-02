// Client entity type. Field names are kept in Spanish to match the
// existing form layer and the API (the API is in English but the
// frontend code base has not been migrated; the field rename is
// tracked separately — see PLAN.md task #9 for the useEntityForm
// rewrite).

export interface Client {
  id: number;
  nombre: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  observaciones?: string;
  total_ordenes?: number;
  ultima_orden?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ClientFormData {
  nombre: string;
  telefono: string;
  email: string;
  direccion: string;
  observaciones: string;
}

export interface ClientHistory {
  total_presupuestos: number;
  total_ordenes: number;
  total_comprado: number;
  ultima_orden: string | null;
  ordenes: Array<{
    id: number;
    numero: string;
    estado: string;
    total: number;
  }>;
  created_at: string;
}
