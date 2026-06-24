import api from './apiClient';

export const getClientes = (params: Record<string, unknown>) => api.get('/clientes', { params });
export const getCliente = (id: number | string) => api.get(`/clientes/${id}`);
export const createCliente = (data: Record<string, unknown>) => api.post('/clientes', data);
export const updateCliente = (id: number | string, data: Record<string, unknown>) => api.put(`/clientes/${id}`, data);
export const deleteCliente = (id: number | string) => api.delete(`/clientes/${id}`);
