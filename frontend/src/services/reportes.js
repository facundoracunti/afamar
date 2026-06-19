import api from './api';

export const getReportePresupuestos = (params) => api.get('/reportes/presupuestos', { params });
export const getReporteOrdenes = (params) => api.get('/reportes/ordenes', { params });
export const getVentasMensuales = (params) => api.get('/reportes/ventas-mensuales', { params });
export const getMaterialesMasUsados = () => api.get('/reportes/materiales-mas-usados');
