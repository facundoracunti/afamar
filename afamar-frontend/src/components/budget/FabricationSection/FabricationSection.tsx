import React, { useMemo } from 'react';
import AdditionalMaterial from '../AdditionalMaterial/AdditionalMaterial';
import type { FabricationDetail, MaterialInForm } from '../../../types/budget';
import styles from './FabricationSection.module.css';

const s = styles as unknown as Record<string, string>;

interface FabricationSectionProps {
  detalles: FabricationDetail[];
  readOnly: boolean;
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
  // Reactivo: la lista de filas de la COMPARATIVA DE MEDICIÓN se deriva
  // estrictamente del `materialsData` actual (= lista viva de la pieza
  // en PiecesSection). El `useMemo` se recalcula cuando el operador
  // agrega, quita o modifica cualquier fila de la pieza (ancla, tramo
  // del principal o fila de alternativa). El filtro descarta filas
  // huérfanas (sin nombre) y filas completamente vacías (sin medición
  // real ni presupuesto), garantizando que NO queden "filas fantasma"
  // tras eliminar/modificar alternativas.
  const comparisonRows = useMemo<MaterialInForm[]>(() => {
    if (!showMeasurementComparison) return [];
    return (materialsData || [])
      .filter((m) => m && m.name && m.name.trim() !== '')
      .map((m) => ({
        ...m,
        // Defensive: filtra filas con `length/width` NaN/null. El form
        // garantiza tipos correctos pero un snapshot legacy podría
        // traer `null` en vez de `0`, lo que rompe `computeM2Real`.
        length: Number(m.length) || 0,
        width: Number(m.width) || 0,
        quantity: Number(m.quantity) || 1,
        m2_budgeted: Number(m.m2_budgeted) || 0,
      }))
      .filter((m) => {
        const m2Real = computeM2Real(m);
        const m2Budgeted = Number(m.m2_budgeted) || 0;
        return m2Real > 0 || m2Budgeted > 0;
      });
  }, [showMeasurementComparison, materialsData]);

  return (
    <div className={`card ${s['fabrication-section']}`}>
      <AdditionalMaterial
        detalles={detalles}
        readOnly={readOnly}
        handleDetailChange={handleDetailChange}
        addDetalle={addDetalle}
        removeDetalle={removeDetalle}
        formMaterials={formMaterials}
        M2_CONCEPTS={M2_CONCEPTS}
        num={num}
      />

      {comparisonRows.length > 0 && (
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
                <th className={s['fabrication-section__comparison-th-center']}>Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((m, i) => {
                const m2Real = computeM2Real(m);
                const m2Budgeted = Number(m.m2_budgeted) || 0;
                // delta = real - budgeted:
                //   > 0  → se agregaron M² (verde — más material del presupuestado)
                //   < 0  → se restaron M² (rojo  — menos material del presupuestado)
                //   === 0 or no budget → neutro
                const delta = m2Real - m2Budgeted;
                const hasBudget = m2Budgeted > 0;
                const deltaClass = !hasBudget
                  ? s['fabrication-section__comparison-cell--neutral']
                  : delta > 0.00001
                    ? s['fabrication-section__comparison-cell--positive']
                    : delta < -0.00001
                      ? s['fabrication-section__comparison-cell--negative']
                      : s['fabrication-section__comparison-cell--neutral'];
                const m2RealClass = hasBudget
                  ? delta > 0.00001
                    ? s['fabrication-section__comparison-cell--positive']
                    : delta < -0.00001
                      ? s['fabrication-section__comparison-cell--negative']
                      : ''
                  : '';
                const deltaStr = hasBudget
                  ? `${delta > 0 ? '+' : ''}${delta.toFixed(5)} m²`
                  : '—';
                return (
                  <tr key={m.id ?? `${m.name}-${i}`} className={s['fabrication-section__comparison-row']}>
                    <td className={s['fabrication-section__comparison-name']}>{m.name}</td>
                    <td className={`${s['fabrication-section__comparison-cell-center']} ${m2RealClass}`}>
                      {m2Real.toFixed(5)} m²
                    </td>
                    <td className={s['fabrication-section__comparison-cell-strong']}>
                      {hasBudget ? `${m2Budgeted} m²` : '—'}
                    </td>
                    <td className={`${s['fabrication-section__comparison-cell-center']} ${deltaClass}`}>
                      {deltaStr}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
