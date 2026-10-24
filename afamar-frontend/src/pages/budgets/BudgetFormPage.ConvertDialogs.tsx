/**
 * Extra dialogs of the budget form: the "convertir a Orden de Trabajo"
 * confirmation (the winning option is copied into the new order) and the
 * "convertir alternativa" confirmation (an order is created with the
 * material of a single alternative option).
 */
import React from 'react';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog/ConfirmDialog';

interface BudgetFormPageConvertDialogsProps {
  showConvertDialog: boolean;
  onCloseConvertDialog: () => void;
  onConfirmConvert: () => void;
  /** Name of the winning option (`null` when there is none). */
  winningOptionName: string | null;
  pendingAltIdx: number | null;
  onClosePendingAlt: () => void;
  onConfirmPendingAlt: () => void;
}

export default function BudgetFormPageConvertDialogs({
  showConvertDialog,
  onCloseConvertDialog,
  onConfirmConvert,
  winningOptionName,
  pendingAltIdx,
  onClosePendingAlt,
  onConfirmPendingAlt,
}: BudgetFormPageConvertDialogsProps) {
  return (
    <>
      <ConfirmDialog
        open={showConvertDialog}
        onCancel={onCloseConvertDialog}
        onConfirm={onConfirmConvert}
        title="Convertir a Orden de Trabajo"
        message={
          winningOptionName && winningOptionName !== 'Opción Única'
            ? `Se guardará y copiará toda la información de la opción "${winningOptionName}": croquis, materiales, detalles de fabricación, piletas, precios y condiciones comerciales. El stock se descuenta del stock de esa opción.`
            : 'Se guardará y copiará toda la información: croquis, material, detalles de fabricación, pileta, firma, precios y condiciones comerciales.'
        }
        confirmLabel="Convertir"
      />

      <ConfirmDialog
        open={pendingAltIdx !== null}
        onCancel={onClosePendingAlt}
        onConfirm={onConfirmPendingAlt}
        title="Convertir alternativa"
        message="Se creará una nueva Orden de Trabajo con el material de esta opción más los trabajos comunes."
        confirmLabel="Convertir"
      />
    </>
  );
}
