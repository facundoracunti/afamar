import http from '../http';
import type { ClientAddress } from '@/types/client';

export const getClientAddresses = (clientId: number) =>
  http.get(`/clients/${clientId}/addresses`).then((r) => (r.data as ClientAddress[]) || []);

export const createClientAddress = (clientId: number, data: { address: string; label?: string | null; is_default?: boolean }) =>
  http.post(`/clients/${clientId}/addresses`, data).then((r) => r.data as ClientAddress);

export const updateClientAddress = (
  clientId: number,
  addressId: number,
  data: { address?: string; label?: string | null; is_default?: boolean },
) => http.put(`/clients/${clientId}/addresses/${addressId}`, data).then((r) => r.data as ClientAddress);

export const deleteClientAddress = (clientId: number, addressId: number) =>
  http.delete(`/clients/${clientId}/addresses/${addressId}`);
