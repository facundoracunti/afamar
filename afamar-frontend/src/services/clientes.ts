import api from './apiClient';

export const getClientes = (params?: Record<string, unknown>) => api.get('/clients', { params });
export const getCliente = (id: number | string) => api.get(`/clients/${id}`);
export const createCliente = (data: Record<string, unknown>) => api.post('/clients', data);
export const updateCliente = (id: number | string, data: Record<string, unknown>) => api.put(`/clients/${id}`, data);
export const deleteCliente = (id: number | string) => api.delete(`/clients/${id}`);
