import http from '../http';

export const getMeasurements = (params?: Record<string, unknown>) => http.get('/measurements', { params });
export const getMeasurement = (id: number | string) => http.get(`/measurements/${id}`);
export const createMeasurement = (data: Record<string, unknown>) => http.post('/measurements', data);
export const updateMeasurement = (id: number | string, data: Record<string, unknown>) => http.put(`/measurements/${id}`, data);
export const deleteMeasurement = (id: number | string) => http.delete(`/measurements/${id}`);