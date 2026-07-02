export interface BudgetSummary {
  id: number;
  number: string;
  customer_name: string | null;
  total: number;
  status: string;
  created_at: string | null;
}

export interface OrderSummary {
  id: number;
  number: string;
  customer_name: string | null;
  total: number;
  status: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface PoolSummary {
  id: number;
  brand: string;
  model: string;
  quantity: number;
}

export interface DashboardData {
  pending_budgets: number;
  orders_in_measurement: number;
  orders_in_workshop: number;
  pools_in_stock: number;
  upcoming_deliveries: number;
  total_active_orders: number;
  total_budgets: number;
  total_orders: number;
  total_revenue: number;
  total_pending_payments: number;
  delivered_orders_this_month: number;
  approved_budgets_this_month: number;
  recent_budgets: BudgetSummary[];
  recent_orders: OrderSummary[];
  pools: PoolSummary[];
  delivered_orders: OrderSummary[];
}