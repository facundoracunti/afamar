import http from '../http';

export const getSettings = () => http.get('/settings');
export const getSetting = (key: string) => http.get(`/settings/${key}`);
export const updateSetting = (key: string, data: Record<string, unknown>) => http.put(`/settings/${key}`, data);

export const uploadLogo = (file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  return http.post('/settings/upload-logo', fd);
};