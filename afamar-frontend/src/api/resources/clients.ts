import http from '../http';
import { createResource } from './createResource';
import type { Client } from '@/types/client';

const clients = createResource<Client, Record<string, unknown>, Record<string, unknown>>('clients');

export const getClients = (params?: Record<string, unknown>) => clients.list(params);
export const getClient = (id: number | string) => clients.get(id);
export const createClient = (data: Record<string, unknown>) => clients.create(data);
export const updateClient = (id: number | string, data: Record<string, unknown>) => clients.update(id, data);
export const deleteClient = (id: number | string) => clients.delete(id);

// Specialised endpoint — kept here because it's the search path the rest
// of the app consumes.
export const searchClients = (q: string) => http.get('/clients/search', { params: { q } });