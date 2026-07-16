import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { getBudgetPdf, convertBudgetToWorkOrder, convertAlternativeToWorkOrder, updateBudget } from '@/api/resources/budgets';
import { todayLocalISO } from '../utils/formatters';
import { buildPdfData } from '../utils/pdf/buildPdfData';
import type { PdfDocumentData } from '../utils/pdf/buildPdfData';
import { useNotify } from '../context/NotificationContext';
import { useSettingsWithTerms } from './useSettingsWithTerms';
import type { BudgetPayload, EntityFormState } from '../types';

interface BudgetFormActionsParams {
  form: EntityFormState;
  setForm: React.Dispatch<React.SetStateAction<EntityFormState>>;
  setSaving: (v: boolean) => void;
  saving: boolean;
  buildPayload: () => Record<string, unknown>;
  isEdit: boolean;
  id: string | undefined;
}

interface BudgetFormActions {
  pdfData: PdfDocumentData | null;
  pdfPreviewLoading: boolean;
  sketchExtractorActive: boolean;
  showConvertDialog: boolean;
  setShowConvertDialog: (v: boolean) => void;
  pendingAltIdx: number | null;
  setPendingAltIdx: (v: number | null) => void;
  handleSubmit: (e?: React.FormEvent) => Promise<boolean>;
  handleGuardar: () => Promise<void>;
  handleAprobar: () => Promise<void>;
  handleConvertirGuardar: () => Promise<void>;
  handleConvertirAlternativa: (idx: number) => Promise<void>;
  handleEnviarWhatsApp: () => void;
  handlePreviewPdf: () => void;
  handleSketchImagesReady: (images: string[]) => void;
  handleClosePdfPreview: () => void;
  handleConfirmarPago: () => Promise<void>;
}

export function useBudgetActions({
  form, setForm, setSaving, saving, buildPayload, isEdit, id,
}: BudgetFormActionsParams): BudgetFormActions {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { company, globalTerms } = useSettingsWithTerms();

  const [pdfData, setPdfData] = useState<PdfDocumentData | null>(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [sketchExtractorActive, setSketchExtractorActive] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [pendingAltIdx, setPendingAltIdx] = useState<number | null>(null);

  const extractError = (err: unknown): string =>
    (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
    || (err as Error).message
    || 'Error inesperado';

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    const wasRejected = form.status === 'REJECTED';
    setSaving(true);
    try {
      const payload = buildPayload();
      await updateBudget(id as string, payload);
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      if (wasRejected) {
        notify('Presupuesto guardado. Estado restablecido a Pendiente — podes volver a aprobarlo.', 'success');
      } else {
        notify('Presupuesto guardado correctamente', 'success');
      }
      setSaving(false);
      return true;
    } catch (err: unknown) {
      notify(extractError(err), 'error');
      setSaving(false);
      return false;
    }
  }, [form.status, buildPayload, id, queryClient, notify, setSaving]);

  const handleGuardar = useCallback(async () => {
    setSaving(true);
    try {
      const payload = buildPayload();
      await updateBudget(id as string, payload);
      notify('Presupuesto guardado correctamente', 'success');
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    } catch (err: unknown) {
      notify(extractError(err), 'error');
    } finally {
      setSaving(false);
    }
  }, [buildPayload, id, queryClient, notify, setSaving]);

  const handleAprobar = useCallback(async () => {
    setSaving(true);
    try {
      const payload = buildPayload();
      const aprobado = { ...payload, status: 'APPROVED' as const } as unknown as BudgetPayload;
      if (['TARJETA DE CRÉDITO', 'TARJETA DE DÉBITO'].includes(form.payment_method)) {
        aprobado.deposit_received = Number(form.total);
        aprobado.balance_due = 0;
        aprobado.balance_paid = true;
        aprobado.deposit_usd = Number(form.total_usd);
        aprobado.balance_due_usd = 0;
        aprobado.balance_paid_at = todayLocalISO();
      }
      await updateBudget(id as string, aprobado as unknown as Record<string, unknown>);
      setForm((prev) => ({
        ...prev,
        status: 'APPROVED',
        deposit_received: aprobado.deposit_received ?? prev.deposit_received,
        deposit_usd: aprobado.deposit_usd ?? prev.deposit_usd,
        balance_due: aprobado.balance_due ?? prev.balance_due,
        balance_due_usd: aprobado.balance_due_usd ?? prev.balance_due_usd,
        balance_paid: aprobado.balance_paid ?? prev.balance_paid,
        balance_paid_at: aprobado.balance_paid_at ?? prev.balance_paid_at,
      }));
      notify('Presupuesto aprobado', 'success');
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    } catch (err: unknown) {
      notify(extractError(err), 'error');
    } finally {
      setSaving(false);
    }
  }, [buildPayload, form, id, queryClient, notify, setSaving, setForm]);

  const handleConvertirGuardar = useCallback(async () => {
    setSaving(true);
    try {
      const payload = buildPayload();
      await updateBudget(id as string, payload);
      const res = await convertBudgetToWorkOrder(id as string);
      setForm((prev) => ({ ...prev, status: 'CONVERTED_TO_OT' }));
      notify(`¡Orden ${res.data.number} creada exitosamente!`, 'success');
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      navigate(`/admin/work-orders/${res.data.id}`);
    } catch (err: unknown) {
      notify(extractError(err), 'error');
    } finally {
      setSaving(false);
    }
  }, [buildPayload, id, queryClient, notify, setSaving, setForm, navigate]);

  const handleConvertirAlternativa = useCallback(async (idx: number) => {
    if (!id) {
      notify('Primero guardá el presupuesto para poder convertir una alternativa.', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await convertAlternativeToWorkOrder(id, idx);
      if (res.status === 201) {
        notify(`¡Orden ${res.data.number} creada exitosamente desde alternativa "${res.data.alternative_name}"!`, 'success');
        queryClient.invalidateQueries({ queryKey: ['budgets'] });
        queryClient.invalidateQueries({ queryKey: ['work-orders'] });
        navigate(`/admin/work-orders/${res.data.id}`);
      }
    } catch (err: unknown) {
      notify(extractError(err), 'error');
    } finally {
      setSaving(false);
    }
  }, [id, queryClient, notify, setSaving, navigate]);

  const handleEnviarWhatsApp = useCallback(() => {
    const phone = (form.client_phone || '').replace(/[^\d]/g, '');
    const nombre = form.client_name || '';
    const pdfUrl = getBudgetPdf(id as string);
    const saludo = nombre ? `Hola ${nombre}! ` : '';
    const mensaje = `${saludo}Te enviamos el presupuesto formal de AFAMAR Mármoles & Granitos. Podés revisarlo e imprimirlo desde el siguiente link: ${pdfUrl}`;
    const whatsappUrl = phone
      ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(mensaje)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
    window.open(whatsappUrl, '_blank');
  }, [form.client_phone, form.client_name, id]);

  const handlePreviewPdf = useCallback(() => {
    setPdfPreviewLoading(true);
    setPdfData(null);
    setSketchExtractorActive(true);
  }, []);

  const handleSketchImagesReady = useCallback((images: string[]) => {
    const data = buildPdfData({
      form: form as unknown as Record<string, unknown>,
      document_type: 'budget',
      overrides: {
        budget_terms: (form as unknown as Record<string, unknown>).budget_terms as string[] | undefined,
        warranty_terms: (form as unknown as Record<string, unknown>).warranty_terms as string[] | undefined,
      },
      company,
      globalTerms,
      sketchImages: images,
    });
    setPdfData(data);
    setPdfPreviewLoading(false);
    setSketchExtractorActive(false);
  }, [form, company, globalTerms]);

  const handleClosePdfPreview = useCallback(() => {
    setPdfData(null);
    setSketchExtractorActive(false);
  }, []);

  const handleConfirmarPago = useCallback(async () => {
    if (!id) return;
    const nuevo = !form.balance_paid;
    const hoy = todayLocalISO();
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
    await updateBudget(id, payload);
    setForm((prev) => ({ ...prev, ...payload, balance_paid_at: nuevo ? hoy : '' } as EntityFormState));
    queryClient.invalidateQueries({ queryKey: ['budgets'] });
  }, [id, form.balance_paid, form.total, form.total_usd, queryClient, setForm]);

  return {
    pdfData,
    pdfPreviewLoading,
    sketchExtractorActive,
    showConvertDialog,
    setShowConvertDialog,
    pendingAltIdx,
    setPendingAltIdx,
    handleSubmit,
    handleGuardar,
    handleAprobar,
    handleConvertirGuardar,
    handleConvertirAlternativa,
    handleEnviarWhatsApp,
    handlePreviewPdf,
    handleSketchImagesReady,
    handleClosePdfPreview,
    handleConfirmarPago,
  };
}
