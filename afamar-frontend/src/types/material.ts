export interface Material {
  id: number;
  name: string;
  category_id?: number;
  color_id?: number;
  /** Resolved color name from the `color_id` FK (kept on the wire for
   * PDF/budget/work-order snapshot compatibility). */
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

export interface MaterialColor {
  id: number;
  name: string;
  category_id?: number | null;
}

export interface MaterialFormData {
  name: string;
  category_id: number | string;
  color_id: number | string;
  available_thickness: string;
  base_price: number;
  price_usd: number;
  currency: 'ARS' | 'USD';
  supplier: string;
  stock_available: number;
  notes: string;
}
