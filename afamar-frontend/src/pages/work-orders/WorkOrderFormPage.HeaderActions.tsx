/**
 * Header actions of the work order form.
 *
 * The buttons rendered inside the `FormHeader`: advance/rollback of the
 * work-order status, the "Trabajo Entregado" badge, the taller sheet, the
 * WhatsApp share, the PDF preview and the save button.
 */
import React from 'react';
import { Eye, MessageCircle, Save } from 'lucide-react';
import { t } from '../../utils/translate';
import type { EntityFormState } from '../../types';
import styles from './WorkOrderFormPage.module.css';

const s = styles as unknown as Record<string, string>;

const STATUS_ROLLBACK: Record<string, string> = {
  WORKSHOP: 'MEASUREMENT',
  FINISHED: 'WORKSHOP',
  DELIVERED: 'FINISHED',
};

interface WorkOrderFormPageHeaderActionsProps {
  form: EntityFormState;
  saving: boolean;
  /** `true` when the order is already saved (the taller sheet needs it). */
  hasId: boolean;
  pdfPreviewLoading: boolean;
  whatsappSending: boolean;
  onStatusChange: (status: string) => void;
  onPrintFicha: () => void;
  onEnviarWhatsApp: () => void;
  onPreviewPdf: () => void;
  onSubmit: (e?: React.FormEvent) => void;
  /** The wizard renders its own save button in the last step. */
  showSaveButton: boolean;
}

export default function WorkOrderFormPageHeaderActions({
  form,
  saving,
  hasId,
  pdfPreviewLoading,
  whatsappSending,
  onStatusChange,
  onPrintFicha,
  onEnviarWhatsApp,
  onPreviewPdf,
  onSubmit,
  showSaveButton,
}: WorkOrderFormPageHeaderActionsProps) {
  return (
    <>
      {form.status === 'MEASUREMENT' && (
        <button type="button" className={s['work-order-form__btn-measurement']} onClick={() => onStatusChange('WORKSHOP')} disabled={saving}>
          🏭 Enviar a Taller
        </button>
      )}
      {form.status === 'WORKSHOP' && (
        <button type="button" className={s['work-order-form__btn-workshop']} onClick={() => onStatusChange('FINISHED')} disabled={saving}>
          ✅ Finalizar Trabajo
        </button>
      )}
      {(form.status === 'WORKSHOP' || form.status === 'FINISHED' || form.status === 'DELIVERED') && (
        <button type="button" className={s['work-order-form__btn-rollback']} onClick={() => onStatusChange(STATUS_ROLLBACK[form.status])} disabled={saving}>
          ↩ Volver a {t(STATUS_ROLLBACK[form.status])}
        </button>
      )}
      {form.status === 'FINISHED' && (
        <button type="button" className={s['work-order-form__btn-delivery']} onClick={() => onStatusChange('DELIVERED')} disabled={saving}>
          🚚 Entregar al Cliente
        </button>
      )}
      {form.status === 'DELIVERED' && (
        <span className={s['work-order-form__badge-delivered']}>
          📦 Trabajo Entregado
        </span>
      )}
      <button type="button" className={`btn btn-outline ${s['work-order-form__preview-btn']}`} onClick={onPrintFicha} disabled={!hasId || pdfPreviewLoading}>
        🖨️ Ficha de Taller
      </button>
      <button type="button" className={`btn ${s['work-order-form__btn-whatsapp']}`} onClick={onEnviarWhatsApp} disabled={saving || whatsappSending}>
        <MessageCircle size={16} /> {whatsappSending ? 'ABRIENDO...' : 'ENVIAR POR WHATSAPP'}
      </button>
      <button type="button" className={`btn btn-outline ${s['work-order-form__preview-btn']}`} onClick={onPreviewPdf} disabled={pdfPreviewLoading}>
        <Eye size={16} /> {pdfPreviewLoading ? 'GENERANDO...' : 'VISTA PREVIA PDF'}
      </button>
      {showSaveButton && (
        <button type="button" className={`btn btn-primary ${s['work-order-form__btn-save']}`} onClick={onSubmit} disabled={saving}>
          <Save size={16} /> {saving ? 'GUARDANDO...' : 'GUARDAR'}
        </button>
      )}
    </>
  );
}
