/**
 * Parseo / derivación pura del módulo de pagos — sin React ni estado.
 * Estas funciones viven acá (y no en `usePaymentAction`) para que el hook
 * quede delgado y los tests de parsing no dependan de un render.
 */
import type { PaymentMethod, PaymentStatus, RegisteredPayment } from '../types/payment.types';
import type { CashMovement } from '../../../types/cash';

/** Mapeo método-módulo → método-backend (caja). */
export const PAYMENT_METHOD_BACKEND_MAP: Record<PaymentMethod, string> = {
  efectivo: 'EFECTIVO',
  efectivo_usd: 'EFECTIVO (USD)',
  transferencia: 'TRANSFERENCIA BANCARIA',
  tarjeta: 'TARJETA DE DÉBITO',
  payway_link: 'TARJETA DE CRÉDITO',
};

/** Inverso de `PAYMENT_METHOD_BACKEND_MAP` (privado — solo el mapeo
 *  movimiento→transaction lo usa). */
const BACKEND_TO_METHOD: Record<string, PaymentMethod> = {
  EFECTIVO: 'efectivo',
  'EFECTIVO (USD)': 'efectivo_usd',
  'TRANSFERENCIA BANCARIA': 'transferencia',
  'TARJETA DE DÉBITO': 'tarjeta',
  'TARJETA DE CRÉDITO': 'payway_link',
};

/** Equivalente ARS de una transacción para el acumulado / saldo del módulo
 *  (que siempre operan en ARS). Un pago en USD (`currency === 'USD'`) se
 *  suma por su `amount_ars`; si la conversión no llegó (fallback defensivo,
 *  p.ej. txs viejas persistidas en localStorage), se usa `amount × usdRate`
 *  y si tampoco hay cotización se cae al `amount` crudo. */
export function amountArsOf(
  tx: { amount: number; currency: 'ARS' | 'USD'; amount_ars?: number | null; usd_rate?: number | null },
  fallbackUsdRate: number,
): number {
  if (tx.currency === 'USD') {
    if (tx.amount_ars != null) return tx.amount_ars;
    if (fallbackUsdRate > 0) return tx.amount * fallbackUsdRate;
    return tx.amount;
  }
  return tx.amount;
}

/** Lee el concepto de un movimiento de caja. Los pagos del módulo lo
 *  persisten en la descripción como `Concepto: <label>` (delimitador " — ").
 *  Los movimientos de seña legacy (`Seña A-000090 - Juan Pérez`) caen al
 *  concepto "Seña". Sin concepto → null. */
export function conceptOf(description?: string | null): string | null {
  if (!description) return null;
  const match = /Concepto:\s*([^—]+)/.exec(description);
  if (match) return match[1].trim();
  if (/^Seña\s/i.test(description)) return 'Seña';
  return null;
}

/** Un movimiento proviene del módulo de pagos si su descripción lleva el
 *  marcador `Concepto:` (los movimientos de seña legacy u otros ingresos
 *  no lo llevan). Es el criterio para contarlos en el acumulado del módulo
 *  y para no duplicarlos con el pagado del form al reconciliar. */
export function isModulePayment(movement: { description?: string | null }): boolean {
  return /Concepto:/i.test(movement.description ?? '');
}

/** Lote/cupón parseado de la descripción del movimiento (`Lote/Cupón: XXX`). */
function loteCuponOf(description?: string | null): string | null {
  if (!description) return null;
  const match = /Lote\/Cupón:\s*([^—]+)/.exec(description);
  return match ? match[1].trim() : null;
}

/** Mapea un `CashMovement` del backend (GET /work-orders/{id}/payments o el
 *  refetch tras una reversión) a un `RegisteredPayment`, derivando concepto
 *  y método desde la descripción / `payment_method`. */
export function mapMovementToPayment(movement: CashMovement): RegisteredPayment {
  const backendName = movement.payment_method ?? '';
  return {
    id: String(movement.id),
    order_id: movement.order_id ?? 0,
    budget_id: null,
    method: BACKEND_TO_METHOD[backendName] ?? 'efectivo',
    amount: Number(movement.amount ?? 0),
    currency: movement.currency === 'USD' ? 'USD' : 'ARS',
    status: 'Pagado',
    lote_cupon: loteCuponOf(movement.description),
    payway_link_url: movement.payway_checkout_url ?? null,
    registered_at: movement.created_at ?? '',
    cash_movement_id: movement.id,
    tarjeta_surcharge_percent: null,
    amount_ars: movement.amount_ars ?? null,
    usd_rate: movement.usd_rate ?? null,
    concept: conceptOf(movement.description),
  };
}

/** Estado de pago derivado de los acumulados del módulo. `saldoPendiente <= 0`
 *  gana siempre (pagado); si el acumulado superó 0 la orden está señalada. */
export function computePaymentStatus(
  montoPagadoAcumulado: number,
  montoSeniaRequerida: number,
  saldoPendiente: number,
): PaymentStatus {
  if (saldoPendiente <= 0) return 'Pagado';
  if (montoPagadoAcumulado > 0) return 'Señado Parcial';
  return 'Pendiente';
}

/** Pago abonado que el preview del PDF debe mostrar en la fila
 *  "Seña / Pagos Registrados". El `moduleAccumulated` ya es la verdad del
 *  módulo (reconcilia los movimientos del backend con `Concepto:`); cuando
 *  el módulo registró algo, es EL pago real. El `depositEnArs` del form se
 *  usa SOLO como fallback legacy (OTs donde nunca se registró un pago por
 *  módulo) — nunca se suma con el acumulado, o el PDF duplicaría el total
 *  (depósito autocompletado = total + pagos del módulo). */
export function resolveTotalPaidArs(
  depositEnArs: number,
  moduleAccumulated: number,
): number {
  return Math.round((moduleAccumulated > 0 ? moduleAccumulated : depositEnArs) * 100) / 100;
}