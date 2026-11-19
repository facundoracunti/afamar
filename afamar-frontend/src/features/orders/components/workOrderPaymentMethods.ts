import type { PaymentMethod } from '../../payments/types/payment.types';

const BACKEND_TO_MODULE: Record<string, PaymentMethod> = {
  EFECTIVO: 'efectivo',
  'EFECTIVO (USD)': 'efectivo_usd',
  'TRANSFERENCIA BANCARIA': 'transferencia',
  'TARJETA DE DÉBITO': 'tarjeta',
  'TARJETA DE CRÉDITO': 'payway_link',
};

const MODULE_TO_BACKEND: Record<PaymentMethod, string> = {
  efectivo: 'EFECTIVO',
  efectivo_usd: 'EFECTIVO (USD)',
  transferencia: 'TRANSFERENCIA BANCARIA',
  tarjeta: 'TARJETA DE DÉBITO',
  payway_link: 'TARJETA DE CRÉDITO',
};

export function resolvePreferredMethod(backendName: string | null | undefined): PaymentMethod | null {
  if (!backendName) return null;
  return BACKEND_TO_MODULE[backendName] ?? null;
}

export function backendMethodFor(method: PaymentMethod | null): string | null {
  if (!method) return null;
  return MODULE_TO_BACKEND[method] ?? null;
}
