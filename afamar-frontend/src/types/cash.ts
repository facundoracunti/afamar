// Cash entity types. English snake_case field names matching the backend API.
// Since Phase 8 (cash registers by session), the box is identified by a
// per-session `number` (#1, #2, ...) instead of a `date`, and there is
// always exactly ONE open box (`is_closed == false`).

export interface CashMovement {
  id: number;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  description?: string | null;
  payment_method?: string | null;
  folder_status?: string | null;
  order_id?: number | null;
  order_number?: string | null;
  order_total?: number | null;
  client_name?: string | null;
  expense_type?: string | null;
  remaining_balance?: number | null;
  daily_cash_id?: number;
  created_at?: string | null;
}

export interface CashSummary {
  number?: number | null;
  opened_at?: string | null;
  closed_at?: string | null;
  duration_seconds?: number;
  total_by_payment?: Record<string, number>;
  ingreso_count?: number;
  egreso_count?: number;
  previous_balance?: number;
  total_income?: number;
  total_expenses?: number;
  current_balance?: number;
  real_cash?: number;
}

export interface CashRegister {
  id: number;
  number?: number | null;
  opened_at?: string | null;
  closed_at?: string | null;
  previous_balance?: number;
  total_income?: number;
  total_expenses?: number;
  total_sum?: number;
  current_balance?: number;
  real_cash?: number;
  is_closed?: boolean;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  movements?: CashMovement[];
}

export interface CashHistoryItem extends CashRegister {
  summary?: CashSummary;
}

export interface CloseCashResult {
  closed_cash: CashRegister;
  summary: CashSummary;
  next_cash: CashRegister;
}
