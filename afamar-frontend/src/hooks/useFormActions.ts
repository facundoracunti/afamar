import { parseApiError } from '../utils/error';
import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { EntityFormState, EntityServices } from '../types';
import { todayLocalISO } from './entityFormHelpers';
import { applyCreditCardAutoFill } from '../utils/creditCardAutoFill';

/** Describes what a save/delete did, so `onAfterAction` callers can
 *  branch (e.g. the work-order form navigates to the freshly-created
 *  record's edit page after a create and stays put after an update). */
export interface AfterActionInfo {
  created?: boolean;
  deleted?: boolean;
  id?: number | string | null;
}

interface UseFormActionsParams {
  form: EntityFormState;
  setForm: React.Dispatch<React.SetStateAction<EntityFormState>>;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  services: EntityServices;
  id: string | undefined;
  isEdit: boolean;
  navigate: (path: string) => void;
  buildPayload: () => Record<string, unknown>;
  /** Optional extra fields merged into the payload on every save. Used by
   *  the form page to send the per-order terms override (`*_terms_override`)
   *  alongside the regular form state, so the saved entity round-trips
   *  into a later PDF download with the same custom terms. */
  extraPayloadFields?: () => Record<string, unknown>;
  /** Called instead of the legacy `alert()` when an action fails. The form
   *  page wires this to `useNotify()` so failures surface as a toast. */
  onError?: (message: string) => void;
  /** If provided, replaces the `navigate(services.listPath)` call after
   *  submit and delete with this callback. The page-mode default keeps
   *  the original behaviour; modal mode wires this to close the modal.
   *  `info` tells the caller what happened so it can decide. */
  onAfterAction?: (info?: AfterActionInfo) => void;
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
  extraPayloadFields,
  onError,
  onAfterAction,
}: UseFormActionsParams) {
  const queryClient = useQueryClient();
  // Guards against double-submission while a save is in flight. Some forms
  // render the GUARDAR button as type="submit" inside a <form> that also
  // wires onSubmit, so a single click can fire two handleSubmit calls;
  // without this ref the duplicate POST creates two identical documents
  // (and two seña movements in the cash box).
  const submittingRef = useRef(false);
  // Once a CREATE succeeds on this mount, block ANY further submit on it.
  // Even with the in-flight guard, the `finally` block re-enables the
  // button before the post-create navigation unmounts the form, leaving a
  // few-ms window where a second click would POST a duplicate order. This
  // ref closes that window permanently (a create that already happened can
  // never happen again on the same mount).
  const createdRef = useRef(false);
  // After any WO/Budget save that may have created/repaid a seña in the
  // open cash box, mark the cash query stale so the next visit to
  // /admin/cash always refetches (the page itself also polls every 5s).
  const invalidateCash = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['cash', 'current'] });
  }, [queryClient]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent): Promise<boolean> => {
      if (submittingRef.current || createdRef.current) return false;
      if (e) e.preventDefault();
      submittingRef.current = true;
      setSaving(true);
      try {
        const payload = { ...buildPayload(), ...(extraPayloadFields?.() ?? {}) };
        // Saving a rejected budget resets its status to PENDING so the user
        // can re-approve it (and eventually convert to a work order).
        // Work orders have no REJECTED status so this is a no-op there.
        const wasRejected = form.status === 'REJECTED';
        if (wasRejected) {
          payload.status = 'PENDING';
        }
        applyCreditCardAutoFill(
          payload,
          form.payment_method,
          form.total,
          form.total_usd,
          todayLocalISO(),
        );
        if (isEdit) {
          await services.update(id as string, payload);
          if (onAfterAction) onAfterAction({ created: false });
          else navigate(services.listPath);
        } else {
          // Se captura la entidad recién creada para que el caller pueda
          // navegar a su página de edición. `createdRef` se setea ANTES de
          // navegar: aunque `finally` re-habilite el botón en la micro-ventana
          // previa al desmonte, ya no se puede re-POSTear otra orden.
          const created = await services.create(payload);
          createdRef.current = true;
          const createdId = (created?.data?.id ?? created?.id ?? null) as number | string | null;
          if (onAfterAction) onAfterAction({ created: true, id: createdId });
          else navigate(services.listPath);
        }
        if (wasRejected) {
          setForm((prev) => ({ ...prev, status: 'PENDING' }));
        }
        invalidateCash();
        return true;
      } catch (err: unknown) {
        onError?.(parseApiError(err, 'Error al guardar'));
        return false;
      } finally {
        submittingRef.current = false;
        setSaving(false);
      }
    },
    [isEdit, id, services, navigate, form.status, form.payment_method, form.total, form.total_usd, buildPayload, extraPayloadFields, invalidateCash, setSaving, setForm, onError]
  );

  const handleDelete = useCallback(async () => {
    if (!id) return;
    await services.delete(id);
    if (onAfterAction) onAfterAction({ deleted: true });
    else navigate(services.listPath);
  }, [id, services, onAfterAction]);

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
          payload.balance_paid_at = todayLocalISO();
        } else {
          applyCreditCardAutoFill(
            payload,
            form.payment_method,
            form.total,
            form.total_usd,
            todayLocalISO(),
          );
        }
        await services.update(id as string, payload);
        setForm((prev) => ({ ...prev, ...payload, status: newStatus }));
        invalidateCash();
      } catch (err: unknown) {
        onError?.(parseApiError(err, 'Error al cambiar estado'));
      } finally {
        setSaving(false);
      }
    },
    [id, form.total, form.total_usd, form.payment_method, services, invalidateCash, setForm, setSaving, onError]
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