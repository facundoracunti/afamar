import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { todayLocalISO } from '../utils/formatters';
import type { EntityFormState } from '../types';

interface UseConfirmPaymentParams {
  id: string | undefined;
  balance_paid: boolean;
  total: number;
  total_usd: number;
  updateFn: (id: string, payload: Record<string, unknown>) => Promise<unknown>;
  queryKey: string[];
  setForm: React.Dispatch<React.SetStateAction<EntityFormState>>;
}

export function useConfirmPayment({
  id, balance_paid, total, total_usd,
  updateFn, queryKey, setForm,
}: UseConfirmPaymentParams) {
  const queryClient = useQueryClient();

  return useCallback(async () => {
    const nuevo = !balance_paid;
    const hoy = todayLocalISO();

    // En modo CREAR no hay id todavía: no se puede persistir. El botón
    // "Deshacer" (desmarcar pago) solo debe revertir el estado local del
    // form (quitar "✓ Saldo cobrado" y la seña autocompletada al 100%),
    // sin llamar al backend.
    if (!id) {
      if (!nuevo) {
        setForm((prev) => ({
          ...prev,
          balance_paid: false,
          balance_paid_at: '',
          deposit_received: 0,
          deposit_currency: 'ARS',
          deposit_usd: 0,
          balance_due: prev.total ?? 0,
          balance_due_usd: prev.total_usd ?? 0,
        } as EntityFormState));
      }
      return;
    }

    const payload: Record<string, unknown> = {
      balance_paid: nuevo,
      balance_paid_at: nuevo ? hoy : null,
    };
    if (nuevo) {
      payload.deposit_received = Number(total);
      payload.deposit_currency = 'ARS';
      payload.balance_due = 0;
      payload.deposit_usd = Number(total_usd);
      payload.balance_due_usd = 0;
    } else {
      // Al desmarcar el pago en EDICIÓN, revertir la seña a 0 (el saldo
      // vuelve a ser el total pendiente).
      payload.deposit_received = 0;
      payload.deposit_currency = 'ARS';
      payload.deposit_usd = 0;
      payload.balance_due = Number(total);
      payload.balance_due_usd = Number(total_usd);
    }
    await updateFn(id, payload);
    setForm((prev) => ({ ...prev, ...payload, balance_paid_at: nuevo ? hoy : '' } as EntityFormState));
    queryClient.invalidateQueries({ queryKey });
  }, [id, balance_paid, total, total_usd, updateFn, queryKey, setForm, queryClient]);
}
