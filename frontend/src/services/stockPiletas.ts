import api from './apiClient';

export const getPiletas = (params: Record<string, unknown>) => api.get('/stock-piletas', { params });
export const getPileta = (id: number | string) => api.get(`/stock-piletas/${id}`);
export const createPileta = (data: Record<string, unknown>) => api.post('/stock-piletas', data);
export const updatePileta = (id: number | string, data: Record<string, unknown>) => api.put(`/stock-piletas/${id}`, data);
export const deletePileta = (id: number | string) => api.delete(`/stock-piletas/${id}`);
export const getMovimientos = (id: number | string) => api.get(`/stock-piletas/${id}/movimientos`);
export const createMovimiento = (id: number | string, data: Record<string, unknown>) => api.post(`/stock-piletas/${id}/movimientos`, data);
