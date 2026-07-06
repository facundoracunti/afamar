import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { EntityFormState } from '../types/form';

export function useConfirmPayment(
  id: string | undefined,
  form: EntityFormState,
  setForm: React.Dispatch<React.SetStateAction<EntityFormState>>,
  updateFn: (id: string, payload: Record<string, unknown>) => Promise<unknown>,
  queryKey: string,
) {
  const queryClient = useQueryClient();

  return useCallback(async () => {
    if (!id) return;
    const nuevo = !form.balance_paid;
    const hoy = new Date().toISOString().split('T')[0];
    const payload: Record<string, unknown> = {
      balance_paid: nuevo,
      balance_paid_at: nuevo ? hoy : null,
    };
    if (nuevo) {
      payload.deposit_received = Number(form.total);
      payload.deposit_currency = 'ARS';
      payload.balance_due = 0;
      payload.deposit_usd = Number(form.total_usd);
      payload.balance_due_usd = 0;
    }
    await updateFn(id, payload);
    setForm((prev) => ({ ...prev, ...payload, balance_paid_at: nuevo ? hoy : '' } as EntityFormState));
    queryClient.invalidateQueries({ queryKey: [queryKey] });
  }, [id, form.balance_paid, form.total, form.total_usd, setForm, updateFn, queryClient, queryKey]);
}
