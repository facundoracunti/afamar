import http from '../http';

export const getSettings = () => http.get('/settings');

export const updateSettings = (data: Record<string, unknown>) => http.put('/settings', data);

export const uploadLogo = (file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  return http.post('/settings/upload-logo', fd);
};

export const uploadDashboardImage = (file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  return http.post('/settings/upload-dashboard-image', fd);
};

export const restoreDashboardImage = () => http.post('/settings/restore-dashboard-image');
