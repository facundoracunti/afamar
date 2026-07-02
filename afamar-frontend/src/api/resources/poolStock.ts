import http from '../http';

export const getPoolStock = (params?: Record<string, unknown>) => http.get('/pool-stock', { params });
export const getPool = (id: number | string) => http.get(`/pool-stock/${id}`);
export const createPool = (data: Record<string, unknown>) => http.post('/pool-stock', mapPoolToApi(data));
export const updatePool = (id: number | string, data: Record<string, unknown>) => http.put(`/pool-stock/${id}`, mapPoolToApi(data));
export const deletePool = (id: number | string) => http.delete(`/pool-stock/${id}`);
export const getPoolMovements = (id: number | string) => http.get(`/pool-stock/${id}/movements`);
export const createPoolMovement = (id: number | string, data: Record<string, unknown>) => http.post(`/pool-stock/${id}/movements`, mapMovementToApi(data));

function mapPoolToApi(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (data.marca !== undefined) out.brand = data.marca;
  if (data.modelo !== undefined) out.model = data.modelo;
  if (data.descripcion !== undefined) out.description = data.descripcion;
  if (data.material !== undefined) out.material = data.material;
  if (data.cantidad !== undefined) out.quantity = data.cantidad;
  if (data.precio !== undefined) out.price = data.precio;
  if (data.precio_usd !== undefined) out.price_usd = data.precio_usd;
  Object.keys(data).forEach((k) => {
    if (!(k in out) && !['marca','modelo','descripcion','cantidad','precio'].includes(k)) {
      out[k] = data[k];
    }
  });
  return out;
}

function mapMovementToApi(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (data.tipo !== undefined) out.type = data.tipo;
  if (data.cantidad !== undefined) out.quantity = data.cantidad;
  if (data.descripcion !== undefined) out.description = data.descripcion;
  return out;
}