import api from './api';

export const getPresupuestos = (params) => api.get('/presupuestos', { params });
export const getPresupuestosUnificados = (params) => api.get('/presupuestos/unificados', { params });
export const getPresupuesto = (id) => api.get(`/presupuestos/${id}`);
export const createPresupuesto = (data) => api.post('/presupuestos', data);
export const updatePresupuesto = (id, data) => api.put(`/presupuestos/${id}`, data);
export const deletePresupuesto = (id) => api.delete(`/presupuestos/${id}`);
export const convertirAOrden = (id) => api.post(`/presupuestos/${id}/convertir-orden`);
export const enviarPresupuestoWhatsApp = (id) => api.post(`/presupuestos/${id}/enviar-whatsapp`);
export const enviarPresupuestoEmail = (id) => api.post(`/presupuestos/${id}/enviar-email`);
export const getNextPresupuestoNumero = () => api.get('/presupuestos/next-numero');
export const getPresupuestoPdf = (id) => `${api.defaults.baseURL}/presupuestos/${id}/pdf`;
