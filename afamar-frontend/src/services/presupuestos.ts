import api from './apiClient';

export const getBudgets = (params?: Record<string, unknown>) => api.get('/budgets', { params });
export const getBudgetsUnified = (params?: Record<string, unknown>) => api.get('/budgets/unified', { params });
export const getBudget = (id: number | string) => api.get(`/budgets/${id}`);
export const createBudget = (data: Record<string, unknown>) => api.post('/budgets', data);
export const updateBudget = (id: number | string, data: Record<string, unknown>) => api.put(`/budgets/${id}`, data);
export const deleteBudget = (id: number | string) => api.delete(`/budgets/${id}`);
export const convertBudgetToWorkOrder = (id: number | string) => api.post(`/budgets/${id}/convert-to-work-order`);
export const sendBudgetWhatsApp = (id: number | string) => api.post(`/budgets/${id}/send-whatsapp`);
export const sendBudgetEmail = (id: number | string) => api.post(`/budgets/${id}/send-email`);
export const getNextBudgetNumber = () => api.get('/budgets/next-number');
export const getBudgetPdf = (id: number | string) => `${api.defaults.baseURL}/budgets/${id}/pdf`;
export const convertAlternativeToWorkOrder = (budgetId: number | string, idx: number) =>
  api.post(`/budgets/${budgetId}/alternatives/${idx}/convert-to-work-order`);

// Backward-compat aliases (used by Spanish-named callers)
export const getPresupuestos = getBudgets;
export const getPresupuestosUnificados = getBudgetsUnified;
export const getPresupuesto = getBudget;
export const createPresupuesto = createBudget;
export const updatePresupuesto = updateBudget;
export const deletePresupuesto = deleteBudget;
export const convertirAOrden = convertBudgetToWorkOrder;
export const enviarPresupuestoWhatsApp = sendBudgetWhatsApp;
export const enviarPresupuestoEmail = sendBudgetEmail;
export const getNextPresupuestoNumero = getNextBudgetNumber;
export const getPresupuestoPdf = getBudgetPdf;
export const convertirAlternativaAOrden = convertAlternativeToWorkOrder;
