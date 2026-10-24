/**
 * Header actions of the budget form.
 *
 * The buttons rendered inside the `FormHeader`: PDF preview, the shortcut to
 * the work order this budget was converted into, the approval button, the
 * save button and the WhatsApp share.
 */
import React from 'react';
import { Eye, Save, FileOutput, Check, Send } from 'lucide-react';
import styles from './BudgetFormPage.module.css';

const s = styles as unknown as Record<string, string>;

interface BudgetFormPageHeaderActionsProps {
  status: string;
  isEdit: boolean;
  /** Number of the work order this budget was converted into (if any). */
  workOrderNumber: string | null;
  saving: boolean;
  pdfPreviewLoading: boolean;
  onPreviewPdf: () => void;
  onOpenWorkOrder: () => void;
  onAprobar: () => void;
  onSubmit: (e?: React.FormEvent) => void;
  onEnviarWhatsApp: () => void;
  /** The wizard renders its own save button in the last step. */
  showSaveButton: boolean;
}

export default function BudgetFormPageHeaderActions({
  status,
  isEdit,
  workOrderNumber,
  saving,
  pdfPreviewLoading,
  onPreviewPdf,
  onOpenWorkOrder,
  onAprobar,
  onSubmit,
  onEnviarWhatsApp,
  showSaveButton,
}: BudgetFormPageHeaderActionsProps) {
  return (
    <>
      <button type="button" className="btn btn-outline" onClick={onPreviewPdf} disabled={pdfPreviewLoading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Eye size={16} /> {pdfPreviewLoading ? 'GENERANDO...' : 'VISTA PREVIA PDF'}
      </button>
      {isEdit ? (
        workOrderNumber ? (
          <button type="button" className={s['budget-form__btn-ot']} onClick={onOpenWorkOrder}>
            <FileOutput size={16} /> OT {workOrderNumber}
          </button>
        ) : ['PENDING', 'ONLINE'].includes(status) ? (
          <button type="button" className={s['budget-form__btn-approve']} onClick={onAprobar}
            disabled={saving}>
            <Check size={16} /> {saving ? 'APROBANDO...' : 'APROBAR PRESUPUESTO'}
          </button>
        ) : null
        ) : showSaveButton ? (
        <button className={`btn btn-primary ${s['budget-form__btn-save']}`} onClick={onSubmit} disabled={saving}>
          <Save size={16} /> {saving ? 'GUARDANDO...' : 'GUARDAR'}
        </button>
      ) : null}
      <button type="button" className="btn btn-success" onClick={onEnviarWhatsApp} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13 }}>
        <Send size={16} /> WhatsApp
      </button>
    </>
  );
}
