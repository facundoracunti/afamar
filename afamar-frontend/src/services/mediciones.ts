import api from './apiClient';

export const getMeasurements = (params?: Record<string, unknown>) => api.get('/measurements', { params });
export const getMeasurement = (id: number | string) => api.get(`/measurements/${id}`);
export const createMeasurement = (data: Record<string, unknown>) => api.post('/measurements', data);
export const updateMeasurement = (id: number | string, data: Record<string, unknown>) => api.put(`/measurements/${id}`, data);
export const deleteMeasurement = (id: number | string) => api.delete(`/measurements/${id}`);

// Backward-compat aliases
export const getMediciones = getMeasurements;
export const getMedicion = getMeasurement;
export const createMedicion = createMeasurement;
export const updateMedicion = updateMeasurement;
export const deleteMedicion = deleteMeasurement;
