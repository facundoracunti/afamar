import http from '../http';
import type { Adicional } from '@/types/adicional';

export const getAdicionales = (params?: Record<string, unknown>) =>
  http.get('/adicionales', { params }).then((r) => (r.data as Adicional[]) || []);

export const getAdicional = (id: number | string) =>
  http.get(`/adicionales/${id}`).then((r) => r.data as Adicional);

export const createAdicional = (data: Partial<Adicional>) =>
  http.post('/adicionales', data).then((r) => r.data as Adicional);

export const updateAdicional = (id: number | string, data: Partial<Adicional>) =>
  http.put(`/adicionales/${id}`, data).then((r) => r.data as Adicional);

export const deleteAdicional = (id: number | string) =>
  http.delete(`/adicionales/${id}`);
