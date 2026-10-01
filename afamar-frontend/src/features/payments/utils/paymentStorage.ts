/**
 * Persistencia en `localStorage` del historial de pagos registrados en la
 * sesión de una Orden de Trabajo. Funciona como espejo client-side mientras
 * no exista un endpoint `GET /work-orders/{id}/payments` histórico; la
 * fuente de verdad de caja sigue siendo el backend (cada `registerPayment`
 * hace POST a `/cash/movements`).
 */
import type { RegisteredPayment } from '../types/payment.types';

/** Key de `localStorage` donde persistimos el historial de pagos
 *  registrados en la sesión de un OT. */
function paymentsStorageKey(orderId: number): string {
  return `afamar.ot.payments.${orderId}`;
}

/** Lee el historial persistido de una OT. Devuelve `[]` si no existe, no
 *  es un array (JSON corrupto) o si corre fuera del browser. */
export function readPersistedPayments(orderId: number): RegisteredPayment[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(paymentsStorageKey(orderId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as RegisteredPayment[];
  } catch {
    return [];
  }
}

/** Escribe (reemplaza) el historial persistido de una OT. Fallos de storage
 *  / cuota se tragan: la sesión sigue funcionando en memoria. */
export function writePersistedPayments(orderId: number, txs: RegisteredPayment[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(paymentsStorageKey(orderId), JSON.stringify(txs));
  } catch {
    // sin permisos de storage / quota lleno — seguimos con la versión
    // en memoria para esta sesión.
  }
}