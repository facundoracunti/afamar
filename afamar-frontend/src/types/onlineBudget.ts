export interface OnlineBudgetItem {
  detail: string;
  length: number;
  width: number;
  m2: number;
  isUnit: boolean;
  currency: 'ARS' | 'USD';
  labor: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  material: string;
  pool_id: number | null;
  option: number;
}

export interface OnlineBudgetPayload {
  clientName: string;
  phone: string;
  workType: string;
  date: string;
  usdRate: number;
  items: OnlineBudgetItem[];
  totalNetArs: number;
  totalNetUsd: number;
  totalConsolidated: number;
  pool_id: number | null;
  pool_price: number;
  status?: string;
}
