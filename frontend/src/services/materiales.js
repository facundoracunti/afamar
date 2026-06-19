import api from './apiClient';

export const getMateriales = (params) => api.get('/materiales', { params });
export const getMaterial = (id) => api.get(`/materiales/${id}`);
export const createMaterial = (data) => api.post('/materiales', data);
export const updateMaterial = (id, data) => api.put(`/materiales/${id}`, data);
export const deleteMaterial = (id) => api.delete(`/materiales/${id}`);
export const getPriceHistory = (id) => api.get(`/materiales/${id}/price-history`);
