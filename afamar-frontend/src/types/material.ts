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
  /**
   * Whether this material can carry an integrated sink ("BACHA INTEGRADA"
   * additional work). Some porous granites (e.g. DALLAS) can't. Defaults to
   * true on the backend; the materials form + additional-works picker use
   * this to hide/flag the bacha option for incompatible materials.
   */
  allows_integrated_sink?: boolean;
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
  allows_integrated_sink: boolean;
  notes: string;
}
