import http from '../http';

export const getMeasurements = (params?: Record<string, unknown>) => http.get('/measurements', { params });
export const getMeasurement = (id: number | string) => http.get(`/measurements/${id}`);
export const createMeasurement = (data: Record<string, unknown>) => http.post('/measurements', mapMeasurementToApi(data));
export const updateMeasurement = (id: number | string, data: Record<string, unknown>) => http.put(`/measurements/${id}`, mapMeasurementToApi(data));
export const deleteMeasurement = (id: number | string) => http.delete(`/measurements/${id}`);

const MEASUREMENT_FIELD_MAP: Record<string, string> = {
  clientName: 'client_name',
  clientPhone: 'client_phone',
  clientAddress: 'client_address',
  scheduledDate: 'scheduled_date',
  scheduledTime: 'scheduled_time',
  observations: 'notes',
  croquis: 'sketch_data',
  photos: 'photos_data',
};

function mapMeasurementToApi(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    out[MEASUREMENT_FIELD_MAP[k] || k] = v;
  }
  return out;
}