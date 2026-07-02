import http from '../http';

export const getSettings = () => http.get('/settings');

export const updateSettings = (data: Record<string, string>) => http.put('/settings', data);

export const uploadLogo = (file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  return http.post('/settings/upload-logo', fd);
};