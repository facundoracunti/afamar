import api from './apiClient';

export const getMateriales = (params?: Record<string, unknown>) => api.get('/materials', { params });
export const getMaterial = (id: number | string) => api.get(`/materials/${id}`);
export const createMaterial = (data: Record<string, unknown>) => api.post('/materials', data);
export const updateMaterial = (id: number | string, data: Record<string, unknown>) => api.put(`/materials/${id}`, data);
export const deleteMaterial = (id: number | string) => api.delete(`/materials/${id}`);
export const getPriceHistory = (id: number | string) => api.get(`/materials/${id}/price-history`);

export const uploadMaterialFoto = (id: number | string, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post(`/materials/${id}/upload-foto`, formData, {
    headers: { 'Content-Type': undefined },
  });
};
