import api from './apiClient';

export const getPoolStock = (params?: Record<string, unknown>) => api.get('/pool-stock', { params });
export const getPool = (id: number | string) => api.get(`/pool-stock/${id}`);
export const createPool = (data: Record<string, unknown>) => api.post('/pool-stock', data);
export const updatePool = (id: number | string, data: Record<string, unknown>) => api.put(`/pool-stock/${id}`, data);
export const deletePool = (id: number | string) => api.delete(`/pool-stock/${id}`);
export const getPoolMovements = (id: number | string) => api.get(`/pool-stock/${id}/movements`);
export const createPoolMovement = (id: number | string, data: Record<string, unknown>) => api.post(`/pool-stock/${id}/movements`, data);

// Backward-compat aliases
export const getPiletas = getPoolStock;
export const getPileta = getPool;
export const createPileta = createPool;
export const updatePileta = updatePool;
export const deletePileta = deletePool;
export const getMovimientos = getPoolMovements;
export const createMovimiento = createPoolMovement;
