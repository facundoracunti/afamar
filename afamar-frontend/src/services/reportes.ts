import api from './apiClient';

export const getBudgetsReport = () => api.get('/reports/budgets');
export const getWorkOrdersReport = () => api.get('/reports/work-orders');
export const getMonthlySales = () => api.get('/reports/monthly-sales');
export const getMostUsedMaterials = () => api.get('/reports/most-used-materials');

// Backward-compat aliases
export const getReportePresupuestos = getBudgetsReport;
export const getReporteOrdenes = getWorkOrdersReport;
export const getVentasMensuales = getMonthlySales;
export const getMaterialesMasUsados = getMostUsedMaterials;
