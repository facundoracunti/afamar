import http from '../http';

export const getWorkOrders = (params?: Record<string, unknown>) => http.get('/work-orders', { params });
export const getWorkOrder = (id: number | string) => http.get(`/work-orders/${id}`);
export const createWorkOrder = (data: Record<string, unknown>) => http.post('/work-orders', data);
export const updateWorkOrder = (id: number | string, data: Record<string, unknown>) => http.put(`/work-orders/${id}`, data);
export const deleteWorkOrder = (id: number | string) => http.delete(`/work-orders/${id}`);
export const getNextWorkOrderNumber = () => http.get('/work-orders/next-number');
export const getWorkOrderPdf = (id: number | string) => `${http.defaults.baseURL}/work-orders/${id}/pdf`;
export const previewWorkOrderPdf = (data: Record<string, unknown>) =>
  http.post('/work-orders/preview-pdf', data, { responseType: 'blob' });