import http from '../http';

export const getBudgets = (params?: Record<string, unknown>) => http.get('/budgets', { params });
export const getBudgetsUnified = (params?: Record<string, unknown>) => http.get('/budgets/unified', { params });
export const getBudget = (id: number | string) => http.get(`/budgets/${id}`);
export const createBudget = (data: Record<string, unknown>) => http.post('/budgets', data);
export const updateBudget = (id: number | string, data: Record<string, unknown>) => http.put(`/budgets/${id}`, data);
export const deleteBudget = (id: number | string) => http.delete(`/budgets/${id}`);
export const convertBudgetToWorkOrder = (id: number | string) => http.post(`/budgets/${id}/convert-to-work-order`);
export const sendBudgetWhatsApp = (id: number | string) => http.post(`/budgets/${id}/send-whatsapp`);
export const sendBudgetEmail = (id: number | string) => http.post(`/budgets/${id}/send-email`);
export const getNextBudgetNumber = () => http.get('/budgets/next-number');
export const getBudgetPdf = (id: number | string) => `${http.defaults.baseURL}/budgets/${id}/pdf`;
export const previewBudgetPdf = (data: Record<string, unknown>) =>
  http.post('/budgets/preview-pdf', data, { responseType: 'blob' });
export const convertAlternativeToWorkOrder = (budgetId: number | string, idx: number) =>
  http.post(`/budgets/${budgetId}/alternatives/${idx}/convert-to-work-order`);

export const mapBudgetStatusToApi = (status: string): Record<string, unknown> => ({
  status: {
    'PENDIENTE': 'PENDING',
    'ENVIADO': 'ONLINE',
    'APROBADO': 'APPROVED',
    'RECHAZADO': 'REJECTED',
    'CONVERTIDO A OT': 'CONVERTED_TO_OT',
  }[status] || status,
});