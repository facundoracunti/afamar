import api from './apiClient';

export const getPiletas = (params) => api.get('/stock-piletas', { params });
export const getPileta = (id) => api.get(`/stock-piletas/${id}`);
export const createPileta = (data) => api.post('/stock-piletas', data);
export const updatePileta = (id, data) => api.put(`/stock-piletas/${id}`, data);
export const deletePileta = (id) => api.delete(`/stock-piletas/${id}`);
export const getMovimientos = (id) => api.get(`/stock-piletas/${id}/movimientos`);
export const createMovimiento = (id, data) => api.post(`/stock-piletas/${id}/movimientos`, data);
