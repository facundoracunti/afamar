import http from '../http';

export const getMaterials = (params?: Record<string, unknown>) => http.get('/materials', { params });
export const getMaterial = (id: number | string) => http.get(`/materials/${id}`);
export const createMaterial = (data: Record<string, unknown>) => http.post('/materials', data);
export const updateMaterial = (id: number | string, data: Record<string, unknown>) => http.put(`/materials/${id}`, data);
export const deleteMaterial = (id: number | string) => http.delete(`/materials/${id}`);
export const getPriceHistory = (id: number | string) => http.get(`/materials/${id}/price-history`);

export const uploadMaterialPhoto = (id: number | string, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return http.post(`/materials/${id}/upload-foto`, formData, {
    headers: { 'Content-Type': undefined },
  });
};