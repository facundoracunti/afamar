import api from './apiClient';

export const getPresupuestosReport = (params?: Record<string, unknown>) => api.get('/reportes/presupuestos', { params });
export const getOrdenesReport = (params?: Record<string, unknown>) => api.get('/reportes/ordenes', { params });
export const getMaterialesReport = (params?: Record<string, unknown>) => api.get('/reportes/materiales', { params });

export const getReportePresupuestos = () => api.get('/reportes/presupuestos');
export const getReporteOrdenes = () => api.get('/reportes/ordenes');
export const getVentasMensuales = () => api.get('/reportes/ventas-mensuales');
export const getMaterialesMasUsados = () => api.get('/reportes/materiales-mas-usados');
