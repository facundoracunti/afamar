import api from './apiClient';

export const getOrdenes = (params: Record<string, unknown>) => api.get('/ordenes-trabajo', { params });
export const getOrden = (id: number | string) => api.get(`/ordenes-trabajo/${id}`);
export const createOrden = (data: Record<string, unknown>) => api.post('/ordenes-trabajo', data);
export const updateOrden = (id: number | string, data: Record<string, unknown>) => api.put(`/ordenes-trabajo/${id}`, data);
export const deleteOrden = (id: number | string) => api.delete(`/ordenes-trabajo/${id}`);
export const getNextNumero = () => api.get('/ordenes-trabajo/next-numero');
export const getOrdenPdf = (id: number | string) => `${api.defaults.baseURL}/ordenes-trabajo/${id}/pdf`;
