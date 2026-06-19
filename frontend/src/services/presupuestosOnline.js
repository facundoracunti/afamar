import api from './api';

export const getPresupuestosOnline = (params) => api.get('/presupuestos-online', { params });
export const getPresupuestoOnline = (id) => api.get(`/presupuestos-online/${id}`);
export const createPresupuestoOnline = (data) => api.post('/presupuestos-online', data);
export const updatePresupuestoOnline = (id, data) => api.put(`/presupuestos-online/${id}`, data);
export const deletePresupuestoOnline = (id) => api.delete(`/presupuestos-online/${id}`);
export const convertirOnlineAOrden = (id) => api.post(`/presupuestos-online/${id}/convertir-orden`);
