import api from './apiClient';

const BASE = '/caja';

export const getCajaDiaria = (fecha) =>
  api.get(`${BASE}/diaria`, { params: { fecha } });

export const getCajaHistorial = (params) =>
  api.get(`${BASE}/historial`, { params });

export const createMovimientoCaja = (data) =>
  api.post(`${BASE}/movimientos`, data);

export const updateMovimientoCaja = (id, data) =>
  api.put(`${BASE}/movimientos/${id}`, data);

export const deleteMovimientoCaja = (id) =>
  api.delete(`${BASE}/movimientos/${id}`);

export const putSaldoAnterior = (fecha, saldo_anterior) =>
  api.put(`${BASE}/saldo-anterior`, { fecha, saldo_anterior });

export const cerrarCaja = (fecha, observaciones) =>
  api.post(`${BASE}/diaria/cerrar`, { fecha, observaciones });
