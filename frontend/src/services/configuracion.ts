import api from './apiClient';

export const getConfig = () => api.get('/configuracion');
export const getConfigByKey = (key: string) => api.get(`/configuracion/${key}`);
export const updateConfig = (key: string, data: Record<string, unknown>) => api.put(`/configuracion/${key}`, data);
export const uploadLogo = (file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post('/configuracion/upload-logo', fd);
};
