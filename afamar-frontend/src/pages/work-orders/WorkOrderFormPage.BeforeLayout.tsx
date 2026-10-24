/**
 * Cards rendered above the material/pieces section of the work order:
 * the status selector, the budget-origin snapshot and the collapsible
 * "Comparativa de medición" toggle.
 */
import React from 'react';
import WorkOrderFormStatus from './WorkOrderFormStatus';
import WorkOrderFormSnapshot from './WorkOrderFormSnapshot';
import type { EntityFormState } from '../../types';
import styles from './WorkOrderFormPage.module.css';

const s = styles as unknown as Record<string, string>;

interface WorkOrderFormPageBeforeLayoutProps {
  form: EntityFormState;
  readOnly: boolean;
  update: (field: string, value: unknown) => void;
  setForm: React.Dispatch<React.SetStateAction<EntityFormState>>;
  showComparisonToggle: boolean;
  setShowComparisonToggle: (v: boolean) => void;
}

export default function WorkOrderFormPageBeforeLayout({
  form,
  readOnly,
  update,
  setForm,
  showComparisonToggle,
  setShowComparisonToggle,
}: WorkOrderFormPageBeforeLayoutProps) {
  return (
    <>
      <div className={s['work-order-form__card-section']}>
        <WorkOrderFormStatus
          form={form}
          readOnly={readOnly}
          update={update}
        />
      </div>
      <div className={s['work-order-form__card-section']}>
        <WorkOrderFormSnapshot form={form} readOnly={readOnly} />
      </div>
      {/* The measurement-comparison toggle is available for BOTH
          work orders converted from a budget (shows estimated vs
          real measures) and direct work orders (the operator can
          still activate it — e.g. to print the real measures as a
          spec reference). It is always visible. */}
      <div className={s['work-order-form__card-section']}>
        <div className={`card ${s['work-order-form__pdf-toggle-card']}`}>
          <div className={s['work-order-form__comparison-toggle-header']}>
            <button
              type="button"
              className={`btn btn-outline ${s['work-order-form__comparison-toggle']}`}
              onClick={() => setShowComparisonToggle(!showComparisonToggle)}
              disabled={readOnly}
            >
              {showComparisonToggle ? '👁️' : '⚖️'}{' '}
              {showComparisonToggle
                ? 'Ocultar Comparativa de medición'
                : 'Activar Comparativa de medición'}
            </button>
            {!showComparisonToggle && (
              <span className={s['work-order-form__comparison-toggle-hint']}>
                Comparativa oculta.
              </span>
            )}
          </div>
          {showComparisonToggle && (
            <div className={s['work-order-form__comparison-toggle-panel']}>
              <label className={s['work-order-form__pdf-toggle']}>
                <input
                  type="checkbox"
                  checked={form.include_measurement_comparison_in_pdf === true}
                  disabled={readOnly}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      include_measurement_comparison_in_pdf: e.target.checked,
                    })
                  }
                />
                <span>Incluir comparativa de medición en el PDF</span>
              </label>
              <p className={s['work-order-form__pdf-toggle-hint']}>
                Muestra la tabla COMPARATIVA DE MEDICIÓN (M² Real / M²
                Presupuestado / Diferencia) en el PDF de esta orden.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
