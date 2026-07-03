import React from 'react';
import ObservationsSection from '../../components/orders/ObservationsSection';
import CroquisEditor from '../../components/sketch/CroquisEditor';
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
        <div className={s['budget-form__sketch']}>
          <CroquisEditor croquis={form.sketch_elements} onChange={(v: unknown) => update('sketch_elements', v)} readOnly={readOnly} />
        </div>
      )}
      <ObservationsSection form={form} readOnly={readOnly} update={update as (field: string, value: unknown) => void} />
    </>
  );
}