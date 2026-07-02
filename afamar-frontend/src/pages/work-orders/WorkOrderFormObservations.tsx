import React from 'react';
import ObservacionesSection from '../../components/ordenes/ObservacionesSection';
import CroquisEditor from '../../components/croquis/CroquisEditor';
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
        <div className={s['work-order-form__croquis']}>
          <CroquisEditor croquis={form.croquis} onChange={(v: unknown) => update('croquis', v)} readOnly={readOnly} />
        </div>
      )}
      <ObservacionesSection form={form} readOnly={readOnly} update={update as (field: string, value: unknown) => void} />
    </>
  );
}