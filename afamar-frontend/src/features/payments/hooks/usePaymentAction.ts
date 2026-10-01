import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCashMovement, type CashMovePayload } from '../../../api/resources/cash';
import type {
  NewPaymentTransaction,
  PaymentBreakdown,
  PaymentMethod,
  PaymentStatus,
  PaymentTransaction,
  RegisteredPayment,
} from '../types/payment.types';
import {
  amountArsOf,
  computePaymentStatus,
  PAYMENT_METHOD_BACKEND_MAP,
} from '../utils/paymentParsing';
import { readPersistedPayments, writePersistedPayments } from '../utils/paymentStorage';

export interface UsePaymentActionParams {
  orderId: number | null;
  orderNumber?: string | null;
  clientName?: string | null;
  montoTotal: number;
  montoPagadoAcumulado: number;
  montoSeniaRequerida?: number;
  preferredMethod?: PaymentMethod | null;
  /** Cotización Dólar Blue Intermedio (ARS/USD). Conversión/fallback de
   *  los pagos en "Dólar billete" (`efectivo_usd`). */
  usdRate?: number;
}

export interface UsePaymentActionReturn {
  breakdown: PaymentBreakdown;
  isRegistering: boolean;
  error: Error | null;
  registerPayment: (tx: NewPaymentTransaction) => Promise<PaymentTransaction>;
  /** Resetea el historial local de pagos del módulo. Útil si el padre
   *  quiere volver a empezar la sesión (p.ej. tras reconciliar con el
   *  backend actualmente no se usa). */
  resetPaidOverride: () => void;
  /** Fusiona los pagos del módulo confirmados por el backend (GET
   *  /work-orders/{id}/payments filtrado por `isModulePayment`) con los de
   *  la sesión. El backend manda (un pago ya reversado desaparece de la
   *  lista); los pagos locales aún sin `cash_movement_id` se conservan.
   *  Es la vía de reconciliación post-reversión para que el "Pagado
   *  acumulado" del módulo refleje la verdad del server. */
  reconcileFromServer: (serverModuleTxs: RegisteredPayment[]) => void;
  /** Transacciones registradas durante esta sesión + las rehidratadas
   *  desde `localStorage` al montar + las reconciliadas desde el backend.
   *  Persiste entre navegaciones y reloads. La fuente de verdad sigue
   *  siendo el backend (cada `registerPayment` hace POST a
   *  `/cash/movements`); el localStorage es un espejo client-side. */
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
    usdRate = 0,
  } = params;

  // Carga inicial desde `localStorage`. Se hace UNA sola vez por mount:
  // si el operador navega a /admin/cash y vuelve, este hook se vuelve a
  // montar y rehidrata las transacciones persistidas.
  const [registeredTransactions, setRegisteredTransactions] = useState<RegisteredPayment[]>(() =>
    orderId !== null ? readPersistedPayments(orderId) : [],
  );

  // Leave del "Pagado acumulado": si la sesión tiene pagos registrados o
  // reconciliados, el acumulado del módulo se deriva de ellos (suma del
  // equivalente ARS). Si no hay ninguno (nunca se registró nada), la
  // sección refleja el `montoPagadoAcumulado` del form.
  const txsOverride = useMemo<number | null>(() => {
    if (registeredTransactions.length === 0) return null;
    return registeredTransactions.reduce((sum, tx) => sum + amountArsOf(tx, usdRate), 0);
  }, [registeredTransactions, usdRate]);

  const montoPagadoEffectivo = txsOverride ?? montoPagadoAcumulado;

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
      const newPagado = montoPagadoEffectivo + amountArsOf(tx, usdRate);
      const newSaldo = Math.max(montoTotal - newPagado, 0);
      // La descripción del movimiento de caja persiste el concepto y la
      // referencia (lote/cupón o link). El prefijo `Concepto:` es el
      // marcador que identifica los pagos del módulo (`isModulePayment`)
      // y del que se re-deriva el concepto en el historial.
      const concepto = tx.concept ?? null;
      const lotePart = tx.lote_cupon ? `Lote/Cupón: ${tx.lote_cupon}` : undefined;
      const paywayPart = tx.payway_link_url ? `Link de pago: ${tx.payway_link_url}` : undefined;
      const description: string | undefined =
        [
          concepto ? `Concepto: ${concepto}` : undefined,
          lotePart ?? paywayPart ?? undefined,
        ]
          .filter((part): part is string => Boolean(part))
          .join(' — ') || undefined;

      const payload: CashMovePayload = {
        type: 'INCOME',
        amount: tx.amount,
        // El backend suma `amount_ars` (equivalente ARS) en los totales de
        // caja: para un pago en USD `amount` va en la moneda nativa.
        currency: tx.currency,
        amount_ars: tx.currency === 'USD' ? (tx.amount_ars ?? null) : undefined,
        usd_rate: tx.currency === 'USD' ? (tx.usd_rate ?? null) : undefined,
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
        amount_ars: tx.amount_ars ?? null,
        usd_rate: tx.usd_rate ?? null,
        status: computePaymentStatus(newPagado, montoSeniaRequerida, newSaldo),
        lote_cupon: tx.lote_cupon,
        payway_link_url: tx.payway_link_url,
        registered_at: cashMovement.created_at ?? new Date().toISOString(),
        cash_movement_id: cashMovement.id,
        tarjeta_surcharge_percent: tx.tarjeta_surcharge_percent ?? null,
        concept: concepto,
      };
    },
    onSuccess: (transaction) => {
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

  const resetPaidOverride = useCallback(() => setRegisteredTransactions([]), []);

  const reconcileFromServer = useCallback(
    (serverModuleTxs: RegisteredPayment[]) => {
      if (orderId === null) return;
      setRegisteredTransactions((prev) => {
        if (serverModuleTxs.length === 0 && prev.length === 0) return prev;
        // El server manda: los pagos locales CONFIRMADOS cuya contraparte
        // ya no existe en el backend (movimiento reversado, ej. el DELETE
        // de /work-orders/{id}/payments/{movement_id}) desaparecen de la
        // lista; los pagos locales aún sin `cash_movement_id` (POST
        // pendiente o historial no confirmado) se conservan. Los ids que
        // sí viven en el server reemplazan a su espejo local (dedupe).
        const serverIds = new Set<number>();
        for (const tx of serverModuleTxs) {
          if (tx.cash_movement_id != null) serverIds.add(tx.cash_movement_id);
        }
        const keptLocal = prev.filter(
          (tx) => tx.cash_movement_id == null || serverIds.has(tx.cash_movement_id),
        );
        const merged = [...serverModuleTxs, ...keptLocal];
        const seenIds = new Set<number>();
        const unique: RegisteredPayment[] = [];
        for (const tx of merged) {
          if (tx.cash_movement_id != null) {
            if (seenIds.has(tx.cash_movement_id)) continue;
            seenIds.add(tx.cash_movement_id);
          }
          unique.push(tx);
        }
        return unique.sort((a, b) => (b.registered_at || '').localeCompare(a.registered_at || ''));
      });
    },
    [orderId],
  );

  return {
    breakdown,
    isRegistering: mutation.isPending,
    error: mutation.error as Error | null,
    registerPayment,
    resetPaidOverride,
    reconcileFromServer,
    registeredTransactions,
  };
}

export default usePaymentAction;