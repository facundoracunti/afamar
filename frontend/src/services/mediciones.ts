import api from './apiClient';

export const getMediciones = (params: Record<string, unknown>) => api.get('/mediciones', { params });
export const getMedicion = (id: number | string) => api.get(`/mediciones/${id}`);
export const createMedicion = (data: Record<string, unknown>) => api.post('/mediciones', data);
export const updateMedicion = (id: number | string, data: Record<string, unknown>) => api.put(`/mediciones/${id}`, data);
export const deleteMedicion = (id: number | string) => api.delete(`/mediciones/${id}`);
