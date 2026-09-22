import { useState, useMemo, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCashMovement, type CashMovePayload } from '../../../api/resources/cash';
import type { PaymentMethod, PaymentStatus, PaymentTransaction, PaymentBreakdown } from '../types/payment.types';
import type { NewPaymentTransaction } from '../components/PaymentModal';

export interface RegisteredPayment extends PaymentTransaction {
  /** Recargo % aplicado (solo para `tarjeta`). Null en el resto. */
  tarjeta_surcharge_percent?: number | null;
}

export const PAYMENT_METHOD_BACKEND_MAP: Record<PaymentMethod, string> = {
  efectivo: 'EFECTIVO',
  transferencia: 'TRANSFERENCIA BANCARIA',
  tarjeta: 'TARJETA DE DÉBITO',
  payway_link: 'TARJETA DE CRÉDITO',
};

/** Key de `localStorage` donde persistimos el historial de pagos
 *  registrados en la sesión de un OT. Funciona como fallback mientras
 *  no exista un endpoint `GET /work-orders/{id}/payments`. */
function paymentsStorageKey(orderId: number): string {
  return `afamar.ot.payments.${orderId}`;
}

function readPersistedPayments(orderId: number): RegisteredPayment[] {
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

function writePersistedPayments(orderId: number, txs: RegisteredPayment[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(paymentsStorageKey(orderId), JSON.stringify(txs));
  } catch {
    // sin permisos de storage / quota lleno — seguimos con la versión
    // en memoria para esta sesión.
  }
}

export function computePaymentStatus(
  montoPagadoAcumulado: number,
  montoSeniaRequerida: number,
  saldoPendiente: number,
): PaymentStatus {
  if (saldoPendiente <= 0) return 'Pagado';
  if (montoPagadoAcumulado > 0) return 'Señado Parcial';
  return 'Pendiente';
}

export interface UsePaymentActionParams {
  orderId: number | null;
  orderNumber?: string | null;
  clientName?: string | null;
  montoTotal: number;
  montoPagadoAcumulado: number;
  montoSeniaRequerida?: number;
  preferredMethod?: PaymentMethod | null;
}

export interface UsePaymentActionReturn {
  breakdown: PaymentBreakdown;
  isRegistering: boolean;
  error: Error | null;
  registerPayment: (tx: NewPaymentTransaction) => Promise<PaymentTransaction>;
  /** Resetea el contador local de pagos. Útil tras un refetch del
   *  formulario padre. */
  resetPaidOverride: () => void;
  /** Transacciones registradas durante esta sesión + las rehidratadas
   *  desde `localStorage` al montar. Persiste entre navegaciones y
   *  reloads. La fuente de verdad sigue siendo el backend (cada
   *  `registerPayment` hace POST a `/cash/movements`); el localStorage
   *  es un espejo client-side para que la UI no quede en $0 al
   *  volver a la OT. */
  registeredTransactions: RegisteredPayment[];
}

export function usePaymentAction(params: UsePaymentActionParams): UsePaymentActionReturn {
  const queryClient = useQueryClient();
  const {
    orderId,
    orderNumber = null,
    clientName = null,
    montoTotal,
    montoPagadoAcumulado,
    montoSeniaRequerida = 0,
    preferredMethod = null,
  } = params;

  // Carga inicial desde `localStorage`. Se hace UNA sola vez por mount:
  // si el operador navega a /admin/cash y vuelve, este hook se vuelve a
  // montar y rehidrata las transacciones persistidas.
  const [registeredTransactions, setRegisteredTransactions] = useState<RegisteredPayment[]>(() =>
    orderId !== null ? readPersistedPayments(orderId) : [],
  );

  // `overridePagado` arranca en la suma de lo persistido: así el
  // "Pagado acumulado" refleja los cobros que ya estaban hechos al
  // momento de rehidratar, sin esperar a un nuevo POST.
  const [overridePagado, setOverridePagado] = useState<number | null>(() => {
    if (orderId === null) return null;
    const txs = readPersistedPayments(orderId);
    if (txs.length === 0) return null;
    return txs.reduce((sum, tx) => sum + tx.amount, 0);
  });

  const montoPagadoEffectivo = overridePagado ?? montoPagadoAcumulado;

  // Persistencia continua: cada vez que cambia la lista, escribimos en
  // `localStorage`. Si falla (cuota / permisos), la sesión sigue
  // funcionando en memoria.
  useEffect(() => {
    if (orderId === null) return;
    writePersistedPayments(orderId, registeredTransactions);
  }, [orderId, registeredTransactions]);

  const saldoPendiente = useMemo<number>(
    () => Math.max(montoTotal - montoPagadoEffectivo, 0),
    [montoTotal, montoPagadoEffectivo],
  );

  const status = useMemo<PaymentStatus>(
    () => computePaymentStatus(montoPagadoEffectivo, montoSeniaRequerida, saldoPendiente),
    [montoPagadoEffectivo, montoSeniaRequerida, saldoPendiente],
  );

  const breakdown: PaymentBreakdown = useMemo(
    () => ({
      monto_total: montoTotal,
      monto_senia_requerida: montoSeniaRequerida,
      monto_pagado_acumulado: montoPagadoEffectivo,
      saldo_pendiente: saldoPendiente,
      status,
      preferred_method: preferredMethod,
      preferred_method_backend: preferredMethod ? PAYMENT_METHOD_BACKEND_MAP[preferredMethod] : null,
    }),
    [montoTotal, montoSeniaRequerida, montoPagadoEffectivo, saldoPendiente, status, preferredMethod],
  );

  const mutation = useMutation({
    mutationFn: async (tx: NewPaymentTransaction): Promise<PaymentTransaction> => {
      if (orderId === null) {
        throw new Error('orderId es requerido para registrar un pago');
      }
      const newPagado = montoPagadoEffectivo + tx.amount;
      const newSaldo = Math.max(montoTotal - newPagado, 0);
      const description: string | undefined = tx.lote_cupon
        ? `Lote/Cupón: ${tx.lote_cupon}`
        : tx.payway_link_url
          ? `Link de pago: ${tx.payway_link_url}`
          : undefined;

      const payload: CashMovePayload = {
        type: 'INCOME',
        amount: tx.amount,
        payment_method: PAYMENT_METHOD_BACKEND_MAP[tx.method],
        order_id: orderId,
        order_number: orderNumber,
        order_total: montoTotal,
        client_name: clientName,
        ...(description !== undefined ? { description } : {}),
      };

      const response = await createCashMovement(payload);
      const cashMovement = response.data;

      return {
        id: String(cashMovement.id),
        order_id: orderId,
        budget_id: null,
        method: tx.method,
        amount: tx.amount,
        currency: tx.currency,
        status: computePaymentStatus(newPagado, montoSeniaRequerida, newSaldo),
        lote_cupon: tx.lote_cupon,
        payway_link_url: tx.payway_link_url,
        registered_at: cashMovement.created_at ?? new Date().toISOString(),
        cash_movement_id: cashMovement.id,
        tarjeta_surcharge_percent: tx.tarjeta_surcharge_percent ?? null,
      };
    },
    onSuccess: (transaction) => {
      setOverridePagado((prev) => (prev ?? montoPagadoAcumulado) + transaction.amount);
      setRegisteredTransactions((prev) => [
        ...prev,
        { ...transaction, tarjeta_surcharge_percent: transaction.tarjeta_surcharge_percent ?? null },
      ]);
      queryClient.invalidateQueries({ queryKey: ['cash', 'current'] });
      // Invalidamos `['work-orders', orderId]` para que la lista del
      // listado refresque el total, pero `useFormReferences.ts` ya
      // preserva los campos del descuento comercial en el refetch.
      if (orderId !== null) {
        queryClient.invalidateQueries({ queryKey: ['work-orders', orderId] });
      }
    },
  });

  const registerPayment = useCallback(
    (tx: NewPaymentTransaction): Promise<PaymentTransaction> => mutation.mutateAsync(tx),
    [mutation],
  );

  const resetPaidOverride = useCallback(() => setOverridePagado(null), []);

  return {
    breakdown,
    isRegistering: mutation.isPending,
    error: mutation.error as Error | null,
    registerPayment,
    resetPaidOverride,
    registeredTransactions,
  };
}

export default usePaymentAction;
