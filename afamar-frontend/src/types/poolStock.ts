// Pool stock entity type. Field names are kept in Spanish to
// match the form layer (useEntityForm.ts, OnlineItemsTable.tsx).

export interface Pool {
  id: number;
  marca: string;
  modelo: string;
  descripcion?: string;
  material?: string;
  cantidad: number;
  precio: number;
  precio_usd: number;
  created_at?: string;
  updated_at?: string;
}

export interface PoolMovement {
  id: number;
  pileta_id: number;
  tipo: string;
  cantidad: number;
  descripcion?: string;
  created_at?: string;
}
