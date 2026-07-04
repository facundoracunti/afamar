export interface Pool {
  id: number;
  brand: string;
  model: string;
  description?: string;
  material?: string;
  quantity: number;
  price: number;
  price_usd: number;
  pool_type_id?: number | null;
  pool_type_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PoolType {
  id: number;
  name: string;
  label: string;
}

export interface PoolMovement {
  id: number;
  pool_id: number;
  type: string;
  quantity: number;
  description?: string;
  created_at?: string;
}
