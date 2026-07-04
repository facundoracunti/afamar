export interface Pool {
  id: number;
  brand: string;
  model: string;
  description?: string;
  material?: string;
  quantity: number;
  price: number;
  price_usd: number;
  created_at?: string;
  updated_at?: string;
}

export interface PoolMovement {
  id: number;
  pool_id: number;
  type: string;
  quantity: number;
  description?: string;
  created_at?: string;
}
