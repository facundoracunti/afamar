import React from 'react';
import ObservationsSection from '../../components/orders/ObservationsSection';
import CroquisEditor from '../../components/sketch/CroquisEditor';
import type { EntityFormState } from '../../types';
import styles from './WorkOrderFormPage.module.css';

const s = styles as unknown as Record<string, string>;

interface WorkOrderFormObservationsProps {
  form: EntityFormState;
  readOnly: boolean;
  showCroquis: boolean;
  setShowCroquis: (v: boolean) => void;
  update: (field: string, value: unknown) => void;
}

export default function WorkOrderFormObservations({
  form,
  readOnly,
  showCroquis,
  setShowCroquis,
  update,
}: WorkOrderFormObservationsProps) {
  return (
    <>
      <div className={s['work-order-form__header']}>
        <button type="button" className={`btn btn-outline ${s['work-order-form__header-toggle']}`} onClick={() => setShowCroquis(!showCroquis)}>
          {showCroquis ? '👁️' : '📐'} {showCroquis ? 'Ocultar Diseño / Croquis' : 'Activar Diseño / Croquis'}
        </button>
        {!showCroquis && <span className={s['work-order-form__header-hint']}>El croquis está oculto. Hacé clic para diseñar.</span>}
      </div>
      {showCroquis && (
        <div className={s['work-order-form__sketch']}>
          <CroquisEditor croquis={form.sketch_elements} onChange={(v: unknown) => update('sketch_elements', v)} readOnly={readOnly} />
        </div>
      )}
      <ObservationsSection form={form} readOnly={readOnly} update={update as (field: string, value: unknown) => void} />
    </>
  );
}