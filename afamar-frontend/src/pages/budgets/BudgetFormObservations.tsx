import React from 'react';
import ObservacionesSection from '../../components/ordenes/ObservacionesSection';
import CroquisEditor from '../../components/croquis/CroquisEditor';
import type { EntityFormState } from '../../types';
import styles from './BudgetFormPage.module.css';

const s = styles as unknown as Record<string, string>;

interface BudgetFormObservationsProps {
  form: EntityFormState;
  readOnly: boolean;
  showCroquis: boolean;
  setShowCroquis: (v: boolean) => void;
  update: (field: string, value: unknown) => void;
}

export default function BudgetFormObservations({
  form,
  readOnly,
  showCroquis,
  setShowCroquis,
  update,
}: BudgetFormObservationsProps) {
  return (
    <>
      <div className={s['budget-form__header']}>
        <button type="button" className={`btn btn-outline ${s['budget-form__header-toggle']}`} onClick={() => setShowCroquis(!showCroquis)}>
          {showCroquis ? '👁️' : '📐'} {showCroquis ? 'Ocultar Diseño' : 'Activar Diseño'}
        </button>
        {!showCroquis && <span className={s['budget-form__header-hint']}>Croquis oculto.</span>}
      </div>
      {showCroquis && (
        <div className={s['budget-form__croquis']}>
          <CroquisEditor croquis={form.croquis} onChange={(v: unknown) => update('croquis', v)} readOnly={readOnly} />
        </div>
      )}
      <ObservacionesSection form={form} readOnly={readOnly} update={update as (field: string, value: unknown) => void} />
    </>
  );
}