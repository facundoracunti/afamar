import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Dashboard
export const getDashboard = () => api.get('/dashboard');

// Clientes
export const getClientes = (params) => api.get('/clientes', { params });
export const getCliente = (id) => api.get(`/clientes/${id}`);
export const createCliente = (data) => api.post('/clientes', data);
export const updateCliente = (id, data) => api.put(`/clientes/${id}`, data);
export const deleteCliente = (id) => api.delete(`/clientes/${id}`);

// Presupuestos
export const getPresupuestos = (params) => api.get('/presupuestos', { params });
export const getPresupuestosUnificados = (params) => api.get('/presupuestos/unificados', { params });
export const getPresupuesto = (id) => api.get(`/presupuestos/${id}`);
export const createPresupuesto = (data) => api.post('/presupuestos', data);
export const updatePresupuesto = (id, data) => api.put(`/presupuestos/${id}`, data);
export const deletePresupuesto = (id) => api.delete(`/presupuestos/${id}`);
export const convertirAOrden = (id) => api.post(`/presupuestos/${id}/convertir-orden`);
export const enviarPresupuestoWhatsApp = (id) => api.post(`/presupuestos/${id}/enviar-whatsapp`);
export const enviarPresupuestoEmail = (id) => api.post(`/presupuestos/${id}/enviar-email`);
export const getNextPresupuestoNumero = () => api.get('/presupuestos/next-numero');

// Órdenes de Trabajo
export const getOrdenes = (params) => api.get('/ordenes-trabajo', { params });
export const getOrden = (id) => api.get(`/ordenes-trabajo/${id}`);
export const createOrden = (data) => api.post('/ordenes-trabajo', data);
export const updateOrden = (id, data) => api.put(`/ordenes-trabajo/${id}`, data);
export const deleteOrden = (id) => api.delete(`/ordenes-trabajo/${id}`);
export const getNextNumero = () => api.get('/ordenes-trabajo/next-numero');

// Materiales
export const getMateriales = (params) => api.get('/materiales', { params });
export const getMaterial = (id) => api.get(`/materiales/${id}`);
export const createMaterial = (data) => api.post('/materiales', data);
export const updateMaterial = (id, data) => api.put(`/materiales/${id}`, data);
export const deleteMaterial = (id) => api.delete(`/materiales/${id}`);
export const getPriceHistory = (id) => api.get(`/materiales/${id}/price-history`);

// Stock Piletas
export const getPiletas = (params) => api.get('/stock-piletas', { params });
export const getPileta = (id) => api.get(`/stock-piletas/${id}`);
export const createPileta = (data) => api.post('/stock-piletas', data);
export const updatePileta = (id, data) => api.put(`/stock-piletas/${id}`, data);
export const deletePileta = (id) => api.delete(`/stock-piletas/${id}`);
export const getMovimientos = (id) => api.get(`/stock-piletas/${id}/movimientos`);
export const createMovimiento = (id, data) => api.post(`/stock-piletas/${id}/movimientos`, data);

// Reportes
export const getReportePresupuestos = (params) => api.get('/reportes/presupuestos', { params });
export const getReporteOrdenes = (params) => api.get('/reportes/ordenes', { params });
export const getVentasMensuales = (params) => api.get('/reportes/ventas-mensuales', { params });
export const getMaterialesMasUsados = () => api.get('/reportes/materiales-mas-usados');

// Mediciones
export const getMediciones = (params) => api.get('/mediciones', { params });
export const getMedicion = (id) => api.get(`/mediciones/${id}`);
export const createMedicion = (data) => api.post('/mediciones', data);
export const updateMedicion = (id, data) => api.put(`/mediciones/${id}`, data);
export const deleteMedicion = (id) => api.delete(`/mediciones/${id}`);

// Configuración
export const getConfig = () => api.get('/configuracion');
export const getConfigByKey = (key) => api.get(`/configuracion/${key}`);
export const updateConfig = (key, data) => api.put(`/configuracion/${key}`, data);
export const uploadLogo = (file) => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post('/configuracion/upload-logo', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

// PDF
export const getPresupuestoPdf = (id) => `${api.defaults.baseURL}/presupuestos/${id}/pdf`;
export const getOrdenPdf = (id) => `${api.defaults.baseURL}/ordenes-trabajo/${id}/pdf`;

// Presupuestos Online
export const getPresupuestosOnline = (params) => api.get('/presupuestos-online', { params });
export const getPresupuestoOnline = (id) => api.get(`/presupuestos-online/${id}`);
export const createPresupuestoOnline = (data) => api.post('/presupuestos-online', data);
export const updatePresupuestoOnline = (id, data) => api.put(`/presupuestos-online/${id}`, data);
export const deletePresupuestoOnline = (id) => api.delete(`/presupuestos-online/${id}`);
export const convertirOnlineAOrden = (id) => api.post(`/presupuestos-online/${id}/convertir-orden`);

export default api;
