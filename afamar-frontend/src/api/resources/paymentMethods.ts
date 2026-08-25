/**
 * API client for the `payment_methods` catalogue.
 *
 * Mirrors the other catalogue resources (`additionalWorks`, `materials`)
 * via `createResource`. The shared `http` interceptor unwraps the
 * `{success, data}` envelope automatically, so callers receive
 * `AxiosResponse<T>` with `r.data` already set to the catalogue entry.
 *
 * Specialised helpers (`getActivePaymentMethods`) wrap the `active_only`
 * query param that the form's "Forma de pago" dropdown needs.
 */
import type { AxiosResponse } from 'axios';
import type { PaymentMethod, PaymentMethodCreate } from '@/types/paymentMethod';
import http from '../http';
import { createResource } from './createResource';

const paymentMethods = createResource<PaymentMethod, PaymentMethodCreate, PaymentMethodCreate>(
  'payment-methods',
);

export const getPaymentMethods = () =>
  paymentMethods.list().then((r) => r.data as PaymentMethod[]);

/** Methods the form's "Forma de pago" `<select>` should offer. */
export const getActivePaymentMethods = async (): Promise<PaymentMethod[]> => {
  const res = await http.get<PaymentMethod[]>('/payment-methods', {
    params: { active_only: true },
  });
  return (res.data as unknown as PaymentMethod[]) || [];
};

export const getPaymentMethod = (id: number) =>
  paymentMethods.get(id).then((r) => r.data as PaymentMethod);

export const createPaymentMethod = (data: PaymentMethodCreate) =>
  paymentMethods.create(data).then((r) => r.data as PaymentMethod);

export const updatePaymentMethod = (id: number, data: PaymentMethodCreate) =>
  paymentMethods.update(id, data).then((r) => r.data as PaymentMethod);

export const deletePaymentMethod = (id: number | string) =>
  paymentMethods.delete(id) as Promise<AxiosResponse<void>>;
