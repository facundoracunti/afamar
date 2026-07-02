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

export const mapOnlineBudgetToApi = (data: Record<string, unknown>): Record<string, unknown> => {
  const mapped: Record<string, unknown> = { ...data };
  if (data.cliente !== undefined) mapped.client_name = data.cliente;
  if (data.telefono !== undefined) mapped.phone = data.telefono;
  if (data.tipo_obra !== undefined) mapped.work_type = data.tipo_obra;
  if (data.fecha !== undefined) mapped.date = data.fecha;
  if (data.dolar_dia !== undefined) mapped.usd_rate = data.dolar_dia;
  if (data.total_neto_ars !== undefined) mapped.total_net_ars = data.total_neto_ars;
  if (data.total_neto_usd !== undefined) mapped.total_net_usd = data.total_neto_usd;
  if (data.total_consolidado !== undefined) mapped.total_consolidated = data.total_consolidado;
  if (data.pileta_id !== undefined) mapped.pool_id = data.pileta_id;
  if (data.pileta_precio !== undefined) mapped.pool_price = data.pileta_precio;
  return mapped;
};