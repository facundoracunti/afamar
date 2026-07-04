import http from '../http';

export const getPoolStock = (params?: Record<string, unknown>) => http.get('/pool-stock', { params });
export const getPool = (id: number | string) => http.get(`/pool-stock/${id}`);
export const createPool = (data: Record<string, unknown>) => http.post('/pool-stock', data);
export const updatePool = (id: number | string, data: Record<string, unknown>) => http.put(`/pool-stock/${id}`, data);
export const deletePool = (id: number | string) => http.delete(`/pool-stock/${id}`);
export const getPoolMovements = (id: number | string) => http.get(`/pool-stock/${id}/movements`);
export const createPoolMovement = (id: number | string, data: Record<string, unknown>) => http.post(`/pool-stock/${id}/movements`, data);
