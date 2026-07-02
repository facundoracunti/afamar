import http from '../http';
import type { ApiResponse } from '../../types/api';

export const createCashMovement = (data: Record<string, unknown>): ApiResponse<Record<string, unknown>> => http.post('/cash/movements', data);
export const deleteCashMovement = (id: number | string): ApiResponse<Record<string, unknown>> => http.delete(`/cash/movements/${id}`);
export const getDailyCash = (date: string, previous_balance?: number): ApiResponse<Record<string, unknown>> => http.get('/cash/daily', { params: { date, previous_balance } });
export const closeDailyCash = (date: string, observations?: string): ApiResponse<Record<string, unknown>> => http.post('/cash/daily/close', { date, observations });
export const setPreviousBalance = (date: string, previous_balance: number): ApiResponse<Record<string, unknown>> => http.put('/cash/previous-balance', { date, previous_balance });
export const getCashHistory = (): ApiResponse<Record<string, unknown>[]> => http.get('/cash/history');