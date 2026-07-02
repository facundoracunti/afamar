import http from '../http';

export const getClients = (params?: Record<string, unknown>) => http.get('/clients', { params });
export const getClient = (id: number | string) => http.get(`/clients/${id}`);
export const createClient = (data: Record<string, unknown>) => http.post('/clients', mapClientToApi(data));
export const updateClient = (id: number | string, data: Record<string, unknown>) => http.put(`/clients/${id}`, mapClientToApi(data));
export const deleteClient = (id: number | string) => http.delete(`/clients/${id}`);

function mapClientToApi(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (data.nombre !== undefined) out.name = data.nombre;
  if (data.telefono !== undefined) out.phone = data.telefono;
  if (data.email !== undefined) out.email = data.email;
  if (data.direccion !== undefined) out.address = data.direccion;
  if (data.observaciones !== undefined) out.notes = data.observaciones;
  Object.keys(data).forEach((k) => {
    if (!(k in out) && !['nombre','telefono','direccion','observaciones'].includes(k)) {
      out[k] = data[k];
    }
  });
  return out;
}