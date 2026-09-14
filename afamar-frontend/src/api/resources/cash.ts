import http from '../http';
import type { AxiosResponse } from 'axios';
import type { ApiResponse } from '../../types/api';
import type { CashMovement, CashRegister, CashHistoryItem, CloseCashResult, CashSummary } from '../../types/cash';

export type CashMovePayload = {
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  description?: string;
  payment_method?: string | null;
  folder_status?: string | null;
  order_id?: number | null;
  order_number?: string | null;
  order_total?: number | null;
  client_name?: string | null;
  expense_type?: string | null;
};

export const createCashMovement = (data: CashMovePayload): ApiResponse<CashMovement> => http.post('/cash/movements', data);
export const deleteCashMovement = (id: number | string): ApiResponse<Record<string, unknown>> => http.delete(`/cash/movements/${id}`);

export const getCurrentCash = (): ApiResponse<CashRegister> => http.get('/cash/current');
export const openCash = (previous_balance = 0): ApiResponse<CashRegister> => http.post('/cash/current/open', { previous_balance });
export const setPreviousBalance = (previous_balance: number): ApiResponse<CashRegister> => http.put('/cash/current/previous-balance', { previous_balance });
export const closeCash = (notes?: string): ApiResponse<CloseCashResult> => http.post('/cash/current/close', { notes });

export const getCashHistory = (params?: { skip?: number; limit?: number }): Promise<AxiosResponse<CashHistoryItem[]>> => http.get('/cash/history', { params });

export type { CashSummary };
