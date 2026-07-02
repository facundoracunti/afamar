import http from '../http';

export const getMeasurements = (params?: Record<string, unknown>) => http.get('/measurements', { params });
export const getMeasurement = (id: number | string) => http.get(`/measurements/${id}`);
export const createMeasurement = (data: Record<string, unknown>) => http.post('/measurements', mapMeasurementToApi(data));
export const updateMeasurement = (id: number | string, data: Record<string, unknown>) => http.put(`/measurements/${id}`, mapMeasurementToApi(data));
export const deleteMeasurement = (id: number | string) => http.delete(`/measurements/${id}`);

const MEASUREMENT_FIELD_MAP: Record<string, string> = {
  cliente_nombre: 'client_name',
  cliente_telefono: 'client_phone',
  cliente_direccion: 'client_address',
  fecha_programada: 'scheduled_date',
  hora_programada: 'scheduled_time',
  observaciones: 'notes',
  croquis: 'sketch_data',
  fotos: 'photos_data',
};

function mapMeasurementToApi(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    out[MEASUREMENT_FIELD_MAP[k] || k] = v;
  }
  return out;
}