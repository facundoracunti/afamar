import api from './apiClient';

export const getMateriales = (params: Record<string, unknown>) => api.get('/materiales', { params });
export const getMaterial = (id: number | string) => api.get(`/materiales/${id}`);
export const createMaterial = (data: Record<string, unknown>) => api.post('/materiales', data);
export const updateMaterial = (id: number | string, data: Record<string, unknown>) => api.put(`/materiales/${id}`, data);
export const deleteMaterial = (id: number | string) => api.delete(`/materiales/${id}`);
export const getPriceHistory = (id: number | string) => api.get(`/materiales/${id}/price-history`);
