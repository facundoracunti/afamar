import api from './apiClient';

export const getSettings = () => api.get('/settings');
export const getSetting = (key: string) => api.get(`/settings/${key}`);
export const updateSetting = (key: string, data: Record<string, unknown>) => api.put(`/settings/${key}`, data);
export const uploadLogo = (file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post('/settings/upload-logo', fd);
};

// Backward-compat aliases
export const getConfig = getSettings;
export const getConfigByKey = getSetting;
export const updateConfig = updateSetting;
