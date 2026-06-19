import api from './api';

export const getMediciones = (params) => api.get('/mediciones', { params });
export const getMedicion = (id) => api.get(`/mediciones/${id}`);
export const createMedicion = (data) => api.post('/mediciones', data);
export const updateMedicion = (id, data) => api.put(`/mediciones/${id}`, data);
export const deleteMedicion = (id) => api.delete(`/mediciones/${id}`);
