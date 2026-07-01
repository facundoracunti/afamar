import api from './apiClient';
import type { ConvertirOpcionResponse } from '../types/orden';
import type { AxiosResponse } from 'axios';

export const getOnlineBudgets = (params?: Record<string, unknown>) => api.get('/online-budgets', { params });
export const getOnlineBudget = (id: number | string) => api.get(`/online-budgets/${id}`);
export const createOnlineBudget = (data: Record<string, unknown>) => api.post('/online-budgets', data);
export const updateOnlineBudget = (id: number | string, data: Record<string, unknown>) => api.put(`/online-budgets/${id}`, data);
export const deleteOnlineBudget = (id: number | string) => api.delete(`/online-budgets/${id}`);
export const convertOnlineBudgetToWorkOrder = (id: number | string) => api.post(`/online-budgets/${id}/convert-to-work-order`);
export const convertOnlineBudgetToWorkOrderOption = (id: number | string, opcion: number): Promise<AxiosResponse<ConvertirOpcionResponse>> =>
  api.post(`/online-budgets/${id}/convert-to-work-order`, null, { params: { opcion } });

// Backward-compat aliases
export const getPresupuestosOnline = getOnlineBudgets;
export const getPresupuestoOnline = getOnlineBudget;
export const createPresupuestoOnline = createOnlineBudget;
export const updatePresupuestoOnline = updateOnlineBudget;
export const deletePresupuestoOnline = deleteOnlineBudget;
export const convertirOnlineAOrden = convertOnlineBudgetToWorkOrder;
export const convertirOnlineAOrdenOpcion = convertOnlineBudgetToWorkOrderOption;
