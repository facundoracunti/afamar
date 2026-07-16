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
    if (!id) return;
    const nuevo = !balance_paid;
    const hoy = todayLocalISO();
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
    }
    await updateFn(id, payload);
    setForm((prev) => ({ ...prev, ...payload, balance_paid_at: nuevo ? hoy : '' } as EntityFormState));
    queryClient.invalidateQueries({ queryKey });
  }, [id, balance_paid, total, total_usd, updateFn, queryKey, setForm, queryClient]);
}
