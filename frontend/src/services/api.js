import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

export default api;

// === Re-exportaciones para retrocompatibilidad ===
export * from './dashboard';
export * from './clientes';
export * from './presupuestos';
export * from './presupuestosOnline';
export * from './ordenes';
export * from './materiales';
export * from './stockPiletas';
export * from './mediciones';
export * from './configuracion';
export * from './reportes';
