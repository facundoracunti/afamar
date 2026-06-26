import api from './apiClient';

export const getTrabajosRealizados = (params?: Record<string, unknown>) => api.get('/trabajos-realizados', { params });
export const getTrabajoRealizado = (id: number | string) => api.get(`/trabajos-realizados/${id}`);
export const createTrabajoRealizado = (data: Record<string, unknown>) => api.post('/trabajos-realizados', data);
export const updateTrabajoRealizado = (id: number | string, data: Record<string, unknown>) => api.put(`/trabajos-realizados/${id}`, data);
export const deleteTrabajoRealizado = (id: number | string) => api.delete(`/trabajos-realizados/${id}`);

export const uploadTrabajoFoto = (id: number | string, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post(`/trabajos-realizados/${id}/upload-foto`, formData, {
    headers: { 'Content-Type': undefined },
  });
};
