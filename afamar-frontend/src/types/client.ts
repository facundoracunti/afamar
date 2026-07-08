export interface ClientAddress {
  id: number;
  client_id: number;
  address: string;
  label?: string | null;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Client {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  totalPurchased?: number;
  lastOrderNumber?: string;
  created_at?: string;
  updated_at?: string;
  /** 1-N alternative delivery addresses (architects with multiple
   *  project sites). The first one is the default. */
  addresses?: ClientAddress[];
}

export interface ClientFormData {
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

export interface ClientHistory {
  totalBudgets: number;
  totalOrders: number;
  totalPurchased: number;
  lastOrderNumber: string | null;
  orders: Array<{
    id: number;
    number: string;
    status: string;
    total: number;
  }>;
  created_at: string;
}
