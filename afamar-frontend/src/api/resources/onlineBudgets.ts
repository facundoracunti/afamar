import http from '../http';
import type { ConvertOptionResponse } from '../../types/workOrder';
import type { AxiosResponse } from 'axios';

export const getOnlineBudgets = (params?: Record<string, unknown>) => http.get('/online-budgets', { params });
export const getOnlineBudget = (id: number | string) => http.get(`/online-budgets/${id}`);
export const createOnlineBudget = (data: Record<string, unknown>) => http.post('/online-budgets', data);
export const updateOnlineBudget = (id: number | string, data: Record<string, unknown>) => http.put(`/online-budgets/${id}`, data);
export const deleteOnlineBudget = (id: number | string) => http.delete(`/online-budgets/${id}`);
export const convertOnlineBudgetToWorkOrder = (id: number | string) => http.post(`/online-budgets/${id}/convert-to-work-order`);
export const convertOnlineBudgetToWorkOrderOption = (id: number | string, opcion: number): Promise<AxiosResponse<ConvertOptionResponse>> =>
  http.post(`/online-budgets/${id}/convert-to-work-order`, null, { params: { opcion } });

export const mapOnlineBudgetToApi = (data: Record<string, unknown>): Record<string, unknown> => {
  const mapped: Record<string, unknown> = { ...data };
  if (data.clientName !== undefined) mapped.client_name = data.clientName;
  else if (data.client_name !== undefined) mapped.client_name = data.client_name;
  else if (data.cliente !== undefined) mapped.client_name = data.cliente;
  if (data.phone !== undefined) mapped.phone = data.phone;
  else if (data.telefono !== undefined) mapped.phone = data.telefono;
  if (data.workType !== undefined) mapped.work_type = data.workType;
  else if (data.work_type !== undefined) mapped.work_type = data.work_type;
  else if (data.tipo_obra !== undefined) mapped.work_type = data.tipo_obra;
  if (data.date !== undefined) mapped.date = data.date;
  else if (data.fecha !== undefined) mapped.date = data.fecha;
  if (data.usdRate !== undefined) mapped.usd_rate = data.usdRate;
  else if (data.usd_rate !== undefined) mapped.usd_rate = data.usd_rate;
  else if (data.dolar_dia !== undefined) mapped.usd_rate = data.dolar_dia;
  if (data.totalNetArs !== undefined) mapped.total_net_ars = data.totalNetArs;
  else if (data.total_net_ars !== undefined) mapped.total_net_ars = data.total_net_ars;
  else if (data.total_neto_ars !== undefined) mapped.total_net_ars = data.total_neto_ars;
  if (data.totalNetUsd !== undefined) mapped.total_net_usd = data.totalNetUsd;
  else if (data.total_net_usd !== undefined) mapped.total_net_usd = data.total_net_usd;
  else if (data.total_neto_usd !== undefined) mapped.total_net_usd = data.total_neto_usd;
  if (data.totalConsolidated !== undefined) mapped.total_consolidated = data.totalConsolidated;
  else if (data.total_consolidated !== undefined) mapped.total_consolidated = data.total_consolidated;
  else if (data.total_consolidado !== undefined) mapped.total_consolidated = data.total_consolidado;
  if (data.poolId !== undefined) mapped.pool_id = data.poolId;
  else if (data.pool_id !== undefined) mapped.pool_id = data.pool_id;
  else if (data.pileta_id !== undefined) mapped.pool_id = data.pileta_id;
  if (data.poolPrice !== undefined) mapped.pool_price = data.poolPrice;
  else if (data.pool_price !== undefined) mapped.pool_price = data.pool_price;
  else if (data.pileta_precio !== undefined) mapped.pool_price = data.pileta_precio;
  return mapped;
};