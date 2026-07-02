import http from '../http';

export const getReportsDashboard = () => http.get('/reports/dashboard');
export const getMonthlySales = () => http.get('/reports/monthly-sales');
export const getMostUsedMaterials = (limit = 10) => http.get('/reports/most-used-materials', { params: { limit } });