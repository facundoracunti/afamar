import React from 'react';
import FabricationTable from '../FabricationTable/FabricationTable';
import { fabricationConcepts } from '../../../utils/formatters';
import type { FabricationDetail, MaterialInForm } from '../../../types/budget';
import styles from './FabricationSection.module.css';

const s = styles as unknown as Record<string, string>;

interface FabricationSectionProps {
  detalles: FabricationDetail[];
  readOnly: boolean;
  /**
   * Materials added to the current budget/WorkOrder (main + alternatives).
   * Forwarded to FabricationTable so the "Asignar a opción" picker is
   * populated from the materials the user has actually loaded on this
   * document — not the global materials catalog.
   */
  formMaterials: MaterialInForm[];
  M2_CONCEPTS: string[];
  num: (v: unknown) => number;
  handleDetailChange: (idx: number, field: string, value: unknown) => void;
  addDetalle: () => void;
  removeDetalle: (idx: number) => void;
  showMeasurementComparison?: boolean;
  /** Materials data with their m² budgeted (for the measurement comparison table). */
  materialsData?: MaterialInForm[];
}

function computeM2Real(m: MaterialInForm): number {
  const length = Number(m.length || 0);
  const width = Number(m.width || 0);
  const quantity = m.quantity || 1;
  return length * width * quantity;
}

export default function FabricationSection({
  detalles,
  readOnly,
  formMaterials,
  M2_CONCEPTS,
  num,
  handleDetailChange,
  addDetalle,
  removeDetalle,
  showMeasurementComparison,
  materialsData,
}: FabricationSectionProps) {
  return (
    <div className={`card ${s['fabrication-section']}`}>
      <FabricationTable
        detalles={detalles}
        readOnly={readOnly}
        handleDetailChange={handleDetailChange}
        addDetalle={addDetalle}
        removeDetalle={removeDetalle}
        formMaterials={formMaterials}
        M2_CONCEPTS={M2_CONCEPTS}
        fabricationConcepts={fabricationConcepts}
        num={num}
      />

      {showMeasurementComparison && (materialsData || []).length > 0 && (
        <div className={s['fabrication-section__comparison']}>
          <h4 className={s['fabrication-section__comparison-title']}>
            <span aria-hidden="true">📐</span> COMPARATIVA DE MEDICIÓN
          </h4>
          <table className={`table ${s['fabrication-section__comparison-table']}`}>
            <thead>
              <tr className={s['fabrication-section__comparison-head-row']}>
                <th className={s['fabrication-section__comparison-th-left']}>Concepto</th>
                <th className={s['fabrication-section__comparison-th-center']}>M² Real</th>
                <th className={s['fabrication-section__comparison-th-center']}>M² Presupuestado</th>
              </tr>
            </thead>
            <tbody>
              {(materialsData || []).map((m, i) => {
                const m2Real = computeM2Real(m);
                return m2Real > 0 ? (
                  <tr key={i} className={s['fabrication-section__comparison-row']}>
                    <td className={s['fabrication-section__comparison-name']}>{m.name}</td>
                    <td className={s['fabrication-section__comparison-cell-center']}>{m2Real.toFixed(5)} m²</td>
                    <td className={s['fabrication-section__comparison-cell-strong']}>
                      {m.m2_budgeted ? `${m.m2_budgeted} m²` : '—'}
                    </td>
                  </tr>
                ) : null;
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
