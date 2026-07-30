import http from '../http';
import { createResource } from './createResource';
import type { Pool } from '@/types/poolStock';

const poolStock = createResource<Pool, Record<string, unknown>, Record<string, unknown>>('pool-stock');

export const getPoolStock = (params?: Record<string, unknown>) => poolStock.list(params);
export const getPool = (id: number | string) => poolStock.get(id);
export const createPool = (data: Record<string, unknown>) => poolStock.create(data);
export const updatePool = (id: number | string, data: Record<string, unknown>) => poolStock.update(id, data);
export const deletePool = (id: number | string) => poolStock.delete(id);

// Specialised sub-resource endpoints.
export const getPoolMovements = (id: number | string) => http.get(`/pool-stock/${id}/movements`);
export const createPoolMovement = (id: number | string, data: Record<string, unknown>) =>
  http.post(`/pool-stock/${id}/movements`, data);