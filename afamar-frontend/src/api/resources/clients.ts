import http from '../http';

export const getClients = (params?: Record<string, unknown>) => http.get('/clients', { params });
export const getClient = (id: number | string) => http.get(`/clients/${id}`);
export const createClient = (data: Record<string, unknown>) => http.post('/clients', data);
export const updateClient = (id: number | string, data: Record<string, unknown>) => http.put(`/clients/${id}`, data);
export const deleteClient = (id: number | string) => http.delete(`/clients/${id}`);