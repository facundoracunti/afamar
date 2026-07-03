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
  if (data.brand !== undefined) out.brand = data.brand;
  if (data.model !== undefined) out.model = data.model;
  if (data.description !== undefined) out.description = data.description;
  if (data.material !== undefined) out.material = data.material;
  if (data.quantity !== undefined) out.quantity = data.quantity;
  if (data.price !== undefined) out.price = data.price;
  if (data.priceUsd !== undefined) out.price_usd = data.priceUsd;
  Object.keys(data).forEach((k) => {
    if (!(k in out) && !['brand','model','description','quantity','price','priceUsd'].includes(k)) {
      out[k] = data[k];
    }
  });
  return out;
}

function mapMovementToApi(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (data.type !== undefined) out.type = data.type;
  if (data.quantity !== undefined) out.quantity = data.quantity;
  if (data.description !== undefined) out.description = data.description;
  return out;
}