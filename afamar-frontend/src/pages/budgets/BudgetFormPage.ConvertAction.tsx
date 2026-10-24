/**
 * Primary action of the budget form: "CONVERTIR A ORDEN".
 *
 * Rendered below "Traslado" inside the budget card (not in the header).
 * When the budget has several options the conversion is blocked until the
 * operator marks exactly one option as the winner.
 */
import React from 'react';
import { FileOutput } from 'lucide-react';
import styles from './BudgetFormPage.module.css';

const s = styles as unknown as Record<string, string>;

interface BudgetFormPageConvertActionProps {
  /** `true` when the budget has 2+ options and the winner is ambiguous. */
  conversionAmbiguous: boolean;
  /** Name of the winning option (`null` when there is none). */
  winningOptionName: string | null;
  saving: boolean;
  onOpenConvertDialog: () => void;
}

export default function BudgetFormPageConvertAction({
  conversionAmbiguous,
  winningOptionName,
  saving,
  onOpenConvertDialog,
}: BudgetFormPageConvertActionProps) {
  return (
    <div className={s['budget-form__convert-block']}>
      <button
        type="button"
        className={`btn btn-primary ${s['budget-form__btn-convert']}`}
        onClick={onOpenConvertDialog}
        disabled={saving || conversionAmbiguous}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        title={
          conversionAmbiguous
            ? 'Marcá una sola opción como ganadora (✓) para poder convertir'
            : winningOptionName
              ? `Se convierte la opción: ${winningOptionName}`
              : undefined
        }
      >
        <FileOutput size={16} /> {saving ? 'CONVIRTIENDO...' : 'CONVERTIR A ORDEN'}
      </button>
      {conversionAmbiguous ? (
        <span className={s['budget-form__convert-hint']}>
          Tenés varias opciones: marcá una sola con ✓ como ganadora para convertir.
        </span>
      ) : winningOptionName && winningOptionName !== 'Opción Única' ? (
        <span className={s['budget-form__convert-hint']}>
          {`Se va a convertir: ${winningOptionName}`}
        </span>
      ) : null}
    </div>
  );
}
