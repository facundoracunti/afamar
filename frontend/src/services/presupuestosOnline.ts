import api from './apiClient';
import type { ConvertirOpcionResponse } from '../types/orden';
import type { AxiosResponse } from 'axios';

export const getPresupuestosOnline = (params: Record<string, unknown>) => api.get('/presupuestos-online', { params });
export const getPresupuestoOnline = (id: number | string) => api.get(`/presupuestos-online/${id}`);
export const createPresupuestoOnline = (data: Record<string, unknown>) => api.post('/presupuestos-online', data);
export const updatePresupuestoOnline = (id: number | string, data: Record<string, unknown>) => api.put(`/presupuestos-online/${id}`, data);
export const deletePresupuestoOnline = (id: number | string) => api.delete(`/presupuestos-online/${id}`);
export const convertirOnlineAOrden = (id: number | string) => api.post(`/presupuestos-online/${id}/convertir-orden`);
export const convertirOnlineAOrdenOpcion = (id: number | string, opcion: number): Promise<AxiosResponse<ConvertirOpcionResponse>> =>
  api.post(`/presupuestos-online/${id}/convertir-orden`, null, { params: { opcion } });
