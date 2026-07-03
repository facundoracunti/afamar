import { useCallback } from 'react';
import type { EntityFormState, EntityServices } from '../types';

interface UseFormActionsParams {
  form: EntityFormState;
  setForm: React.Dispatch<React.SetStateAction<EntityFormState>>;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  services: EntityServices;
  id: string | undefined;
  isEdit: boolean;
  navigate: (path: string) => void;
  buildPayload: () => Record<string, unknown>;
}

/**
 * Composable: handles submit, delete, status changes, and printing
 * for both budgets and work orders. Replaces the top half of the
 * legacy `useEntityForm` (handleSubmit/Delete/StatusChange/Print).
 *
 * Status changes carry domain-specific side effects:
 *  - DELIVERED work orders: mark balance as paid
 *  - Credit/debit-card payment methods: pre-fill deposit + balance
 */
export function useFormActions({
  form,
  setForm,
  setSaving,
  services,
  id,
  isEdit,
  navigate,
  buildPayload,
}: UseFormActionsParams) {
  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      setSaving(true);
      try {
        const payload = buildPayload();
        if (['TARJETA DE CRÉDITO', 'TARJETA DE DÉBITO'].includes(form.payment_method)) {
          payload.deposit_received = Number(form.total);
          payload.balance_due = 0;
          payload.balance_paid = true;
          payload.deposit_usd = Number(form.total_usd);
          payload.balance_due_usd = 0;
          payload.balance_paid_at = new Date().toISOString().slice(0, 10);
        }
        if (isEdit) {
          await services.update(id as string, payload);
        } else {
          await services.create(payload);
        }
        navigate(services.listPath);
      } catch {
        alert('Error al guardar');
      } finally {
        setSaving(false);
      }
    },
    [isEdit, id, services, navigate, form.payment_method, form.total, form.total_usd, buildPayload, setSaving]
  );

  const handleDelete = useCallback(async () => {
    if (!id) return;
    await services.delete(id);
    navigate(services.listPath);
  }, [id, services, navigate]);

  const handleStatusChangeAction = useCallback(
    async (newStatus: string) => {
      if (!id) return;
      setSaving(true);
      try {
        const payload: Record<string, unknown> = { status: newStatus };
        if (newStatus === 'ENTREGADA') {
          payload.deposit_received = Number(form.total);
          payload.deposit_currency = 'ARS';
          payload.balance_due = 0;
          payload.deposit_usd = Number(form.total_usd);
          payload.balance_due_usd = 0;
          payload.balance_paid = true;
          payload.balance_paid_at = new Date().toISOString().slice(0, 10);
        } else if (['TARJETA DE CRÉDITO', 'TARJETA DE DÉBITO'].includes(form.payment_method)) {
          payload.deposit_received = Number(form.total);
          payload.balance_due = 0;
          payload.balance_paid = true;
          payload.deposit_usd = Number(form.total_usd);
          payload.balance_due_usd = 0;
          payload.balance_paid_at = new Date().toISOString().slice(0, 10);
        }
        await services.update(id as string, payload);
        setForm((prev) => ({ ...prev, ...payload, status: newStatus }));
      } catch {
        alert('Error al cambiar estado');
      } finally {
        setSaving(false);
      }
    },
    [id, form.total, form.total_usd, form.payment_method, services, setForm, setSaving]
  );

  const handlePrint = useCallback(() => {
    if (id && services.getPdfUrl) {
      window.open(services.getPdfUrl(id), '_blank');
    } else {
      window.print();
    }
  }, [id, services]);

  return { handleSubmit, handleDelete, handleStatusChangeAction, handlePrint };
}