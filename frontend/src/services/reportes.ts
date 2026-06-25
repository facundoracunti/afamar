import api from './apiClient';

export const getReportePresupuestos = () => api.get('/reportes/presupuestos');
export const getReporteOrdenes = () => api.get('/reportes/ordenes');
export const getVentasMensuales = () => api.get('/reportes/ventas-mensuales');
export const getMaterialesMasUsados = () => api.get('/reportes/materiales-mas-usados');
