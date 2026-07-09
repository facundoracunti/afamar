import http from '../http';
import type { AdditionalWork } from '@/types/additionalWork';

export const getAdditionalWorks = (params?: Record<string, unknown>) =>
  http.get('/additional-works', { params }).then((r) => (r.data as AdditionalWork[]) || []);

export const getAdditionalWork = (id: number | string) =>
  http.get(`/additional-works/${id}`).then((r) => r.data as AdditionalWork);

export const createAdditionalWork = (data: Partial<AdditionalWork>) =>
  http.post('/additional-works', data).then((r) => r.data as AdditionalWork);

export const updateAdditionalWork = (id: number | string, data: Partial<AdditionalWork>) =>
  http.put(`/additional-works/${id}`, data).then((r) => r.data as AdditionalWork);

export const deleteAdditionalWork = (id: number | string) =>
  http.delete(`/additional-works/${id}`);
