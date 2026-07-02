import http from '../http';
import type { ConvertirOpcionResponse } from '../../types/orden';
import type { AxiosResponse } from 'axios';

export const getOnlineBudgets = (params?: Record<string, unknown>) => http.get('/online-budgets', { params });
export const getOnlineBudget = (id: number | string) => http.get(`/online-budgets/${id}`);
export const createOnlineBudget = (data: Record<string, unknown>) => http.post('/online-budgets', data);
export const updateOnlineBudget = (id: number | string, data: Record<string, unknown>) => http.put(`/online-budgets/${id}`, data);
export const deleteOnlineBudget = (id: number | string) => http.delete(`/online-budgets/${id}`);
export const convertOnlineBudgetToWorkOrder = (id: number | string) => http.post(`/online-budgets/${id}/convert-to-work-order`);
export const convertOnlineBudgetToWorkOrderOption = (id: number | string, opcion: number): Promise<AxiosResponse<ConvertirOpcionResponse>> =>
  http.post(`/online-budgets/${id}/convert-to-work-order`, null, { params: { opcion } });