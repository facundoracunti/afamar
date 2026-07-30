import type { AxiosResponse } from 'axios';
import type { AdditionalWork } from '@/types/additionalWork';
import { createResource } from './createResource';

const additionalWorks = createResource<AdditionalWork, Partial<AdditionalWork>, Partial<AdditionalWork>>(
  'additional-works',
);

// Returns AxiosResponse for paginated callers.
export const getAdditionalWorksPaginated = (params: { skip: number; limit: number }) =>
  additionalWorks.list(params) as Promise<AxiosResponse<AdditionalWork[]>>;

// Unwrapped helpers for forms and single-item consumers.
export const getAdditionalWorks = (params?: Record<string, unknown>) =>
  additionalWorks.list(params).then((r) => (r.data as AdditionalWork[]) || []);

export const getAdditionalWork = (id: number | string) =>
  additionalWorks.get(id).then((r) => r.data as AdditionalWork);

export const createAdditionalWork = (data: Partial<AdditionalWork>) =>
  additionalWorks.create(data).then((r) => r.data as AdditionalWork);

export const updateAdditionalWork = (id: number | string, data: Partial<AdditionalWork>) =>
  additionalWorks.update(id, data).then((r) => r.data as AdditionalWork);

export const deleteAdditionalWork = (id: number | string) =>
  additionalWorks.delete(id);