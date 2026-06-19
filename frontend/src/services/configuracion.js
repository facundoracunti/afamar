import api from './apiClient';

export const getConfig = () => api.get('/configuracion');
export const getConfigByKey = (key) => api.get(`/configuracion/${key}`);
export const updateConfig = (key, data) => api.put(`/configuracion/${key}`, data);
export const uploadLogo = (file) => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post('/configuracion/upload-logo', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
