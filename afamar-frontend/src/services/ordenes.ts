import api from './apiClient';

export const getWorkOrders = (params?: Record<string, unknown>) => api.get('/work-orders', { params });
export const getWorkOrder = (id: number | string) => api.get(`/work-orders/${id}`);
export const createWorkOrder = (data: Record<string, unknown>) => api.post('/work-orders', data);
export const updateWorkOrder = (id: number | string, data: Record<string, unknown>) => api.put(`/work-orders/${id}`, data);
export const deleteWorkOrder = (id: number | string) => api.delete(`/work-orders/${id}`);
export const getNextWorkOrderNumber = () => api.get('/work-orders/next-number');
export const getWorkOrderPdf = (id: number | string) => `${api.defaults.baseURL}/work-orders/${id}/pdf`;

// Backward-compat aliases
export const getOrdenes = getWorkOrders;
export const getOrden = getWorkOrder;
export const createOrden = createWorkOrder;
export const updateOrden = updateWorkOrder;
export const deleteOrden = deleteWorkOrder;
export const getNextNumero = getNextWorkOrderNumber;
export const getOrdenPdf = getWorkOrderPdf;
