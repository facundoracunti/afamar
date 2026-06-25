import api from './apiClient';
import type { ApiResponse } from '../types/api';

export const crearMovimiento = (data: Record<string, unknown>): ApiResponse<Record<string, unknown>> => api.post('/caja/movimientos', data);
export const createMovimientoCaja = (data: Record<string, unknown>): ApiResponse<Record<string, unknown>> => api.post('/caja/movimientos', data);
export const eliminarMovimiento = (id: number | string): ApiResponse<Record<string, unknown>> => api.delete(`/caja/movimientos/${id}`);
export const deleteMovimientoCaja = (id: number | string): ApiResponse<Record<string, unknown>> => api.delete(`/caja/movimientos/${id}`);
export const getCajaDiaria = (fecha: string, saldo_anterior?: number): ApiResponse<Record<string, unknown>> => api.get('/caja/diaria', { params: { fecha, saldo_anterior } });
export const cerrarCaja = (fecha: string, observaciones?: string): ApiResponse<Record<string, unknown>> => api.post('/caja/diaria/cerrar', { fecha, observaciones });
export const putSaldoAnterior = (fecha: string, saldo_anterior: number): ApiResponse<Record<string, unknown>> => api.put('/caja/saldo-anterior', { fecha, saldo_anterior });
export const getCajaHistorial = (): ApiResponse<Record<string, unknown>[]> => api.get('/caja/historial');
