export interface Material {
  id: number;
  name: string;
  categoryId?: string;
  color?: string;
  availableThickness?: string;
  basePrice: number;
  priceUsd: number;
  currency: 'ARS' | 'USD';
  supplier?: string;
  stockAvailable?: number;
  photo?: string;
  notes?: string;
  created_at?: string;
}

export interface MaterialFormData {
  name: string;
  categoryId: string;
  color: string;
  availableThickness: string;
  basePrice: number;
  priceUsd: number;
  currency: 'ARS' | 'USD';
  supplier: string;
  stockAvailable: number;
  notes: string;
}
