export interface Material {
  id: number;
  name: string;
  category_id?: number;
  color?: string;
  available_thickness?: string;
  base_price: number;
  price_usd: number;
  currency: 'ARS' | 'USD';
  supplier?: string;
  stock_available?: number;
  photo?: string;
  notes?: string;
  created_at?: string;
}

export interface MaterialFormData {
  name: string;
  category_id: number | string;
  color: string;
  available_thickness: string;
  base_price: number;
  price_usd: number;
  currency: 'ARS' | 'USD';
  supplier: string;
  stock_available: number;
  notes: string;
}
