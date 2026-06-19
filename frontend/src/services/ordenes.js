import api from './apiClient';

export const getOrdenes = (params) => api.get('/ordenes-trabajo', { params });
export const getOrden = (id) => api.get(`/ordenes-trabajo/${id}`);
export const createOrden = (data) => api.post('/ordenes-trabajo', data);
export const updateOrden = (id, data) => api.put(`/ordenes-trabajo/${id}`, data);
export const deleteOrden = (id) => api.delete(`/ordenes-trabajo/${id}`);
export const getNextNumero = () => api.get('/ordenes-trabajo/next-numero');
export const getOrdenPdf = (id) => `${api.defaults.baseURL}/ordenes-trabajo/${id}/pdf`;
