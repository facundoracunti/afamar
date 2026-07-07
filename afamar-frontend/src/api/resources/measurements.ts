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
  sketch: 'sketch_data',
  photos: 'photos_data',
  workOrderId: 'work_order_id',
};

// `sketch_data` and `photos_data` are stored as JSON-encoded strings in
// TEXT columns on the backend. Pydantic v2 won't auto-coerce arrays to
// strings, so we serialize here before sending.
const JSON_STRINGIFIED_FIELDS = new Set(['sketch_data', 'photos_data']);

function mapMeasurementToApi(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    const target = MEASUREMENT_FIELD_MAP[k] || k;
    if (JSON_STRINGIFIED_FIELDS.has(target)) {
      if (v === null || v === undefined) {
        out[target] = null;
      } else if (typeof v === 'string') {
        out[target] = v;
      } else {
        try { out[target] = JSON.stringify(v); } catch { out[target] = null; }
      }
    } else {
      out[target] = v;
    }
  }
  return out;
}