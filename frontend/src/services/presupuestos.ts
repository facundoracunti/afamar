import api from './apiClient';

export const getPresupuestos = (params: Record<string, unknown>) => api.get('/presupuestos', { params });
export const getPresupuestosUnificados = (params: Record<string, unknown>) => api.get('/presupuestos/unificados', { params });
export const getPresupuesto = (id: number | string) => api.get(`/presupuestos/${id}`);
export const createPresupuesto = (data: Record<string, unknown>) => api.post('/presupuestos', data);
export const updatePresupuesto = (id: number | string, data: Record<string, unknown>) => api.put(`/presupuestos/${id}`, data);
export const deletePresupuesto = (id: number | string) => api.delete(`/presupuestos/${id}`);
export const convertirAOrden = (id: number | string) => api.post(`/presupuestos/${id}/convertir-orden`);
export const enviarPresupuestoWhatsApp = (id: number | string) => api.post(`/presupuestos/${id}/enviar-whatsapp`);
export const enviarPresupuestoEmail = (id: number | string) => api.post(`/presupuestos/${id}/enviar-email`);
export const getNextPresupuestoNumero = () => api.get('/presupuestos/next-numero');
export const getPresupuestoPdf = (id: number | string) => `${api.defaults.baseURL}/presupuestos/${id}/pdf`;
export const convertirAlternativaAOrden = (presupuestoId: number | string, idx: number) => api.post(`/presupuestos/${presupuestoId}/alternativas/${idx}/convertir-a-orden`);
