import api from './apiClient';

export const getDashboard = () => api.get('/dashboard');
