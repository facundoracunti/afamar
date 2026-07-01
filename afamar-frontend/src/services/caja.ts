import api from './apiClient';
import type { ApiResponse } from '../types/api';

export const createCashMovement = (data: Record<string, unknown>): ApiResponse<Record<string, unknown>> => api.post('/cash/movements', data);
export const deleteCashMovement = (id: number | string): ApiResponse<Record<string, unknown>> => api.delete(`/cash/movements/${id}`);
export const getDailyCash = (date: string, previous_balance?: number): ApiResponse<Record<string, unknown>> => api.get('/cash/daily', { params: { date, previous_balance } });
export const closeDailyCash = (date: string, observations?: string): ApiResponse<Record<string, unknown>> => api.post('/cash/daily/close', { date, observations });
export const setPreviousBalance = (date: string, previous_balance: number): ApiResponse<Record<string, unknown>> => api.put('/cash/previous-balance', { date, previous_balance });
export const getCashHistory = (): ApiResponse<Record<string, unknown>[]> => api.get('/cash/history');

// Backward-compat aliases
export const crearMovimiento = createCashMovement;
export const createMovimientoCaja = createCashMovement;
export const eliminarMovimiento = deleteCashMovement;
export const deleteMovimientoCaja = deleteCashMovement;
export const getCajaDiaria = getDailyCash;
export const cerrarCaja = closeDailyCash;
export const putSaldoAnterior = setPreviousBalance;
export const getCajaHistorial = getCashHistory;
