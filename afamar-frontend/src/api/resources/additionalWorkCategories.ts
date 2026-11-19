import type { AdditionalWorkCategory } from '@/types/additionalWork';
import http from '../http';

export const getAdditionalWorkCategories = () => http.get('/additional-work-categories').then((r) => (r.data || []) as AdditionalWorkCategory[]);
export const createAdditionalWorkCategory = (data: Partial<AdditionalWorkCategory>) => http.post('/additional-work-categories', data);
export const updateAdditionalWorkCategory = (id: number, data: Partial<AdditionalWorkCategory>) => http.put(`/additional-work-categories/${id}`, data);
export const deleteAdditionalWorkCategory = (id: number) => http.delete<{ deleted: boolean; reassigned: number }>(`/additional-work-categories/${id}`).then((r) => r.data);
