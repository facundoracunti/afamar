import React from 'react';
import { formatCurrency, fabricationConcepts } from '../../../utils/formatters';
import FabricationTable from './FabricationTable';
import type { MaterialInForm } from '../../../types';

interface FabricationSectionProps {
  detalles: Record<string, unknown>[];
  readOnly: boolean;
  materiales: Record<string, unknown>[];
  M2_CONCEPTS: string[];
  num: (v: unknown) => number;
  handleDetailChange: (idx: number, field: string, value: unknown) => void;
  addDetalle: () => void;
  removeDetalle: (idx: number) => void;
  showMeasurementComparison?: boolean;
  materialsData?: MaterialInForm[];
}

export default function FabricationSection({
  detalles,
  readOnly,
  materiales,
  M2_CONCEPTS,
  num,
  handleDetailChange,
  addDetalle,
  removeDetalle,
  showMeasurementComparison,
  materialsData,
}: FabricationSectionProps) {
  return (
    <div className="card">
      <FabricationTable
        detalles={detalles}
        readOnly={readOnly}
        handleDetailChange={handleDetailChange}
        addDetalle={addDetalle}
        removeDetalle={removeDetalle}
        materiales={materiales}
        M2_CONCEPTS={M2_CONCEPTS}
        fabricationConcepts={fabricationConcepts}
        num={num}
      />

      {showMeasurementComparison && (materialsData || []).length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>📐 COMPARATIVA DE MEDICIÓN</h4>
          <table className="table" style={{ fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px' }}>Concepto</th>
                <th style={{ textAlign: 'center', padding: '8px 12px' }}>M² Real</th>
                <th style={{ textAlign: 'center', padding: '8px 12px' }}>M² Presupuestado</th>
              </tr>
            </thead>
            <tbody>
              {(materialsData || []).map((m: MaterialInForm, i: number) => {
                const m2Real = Number(m.length || 0) * Number(m.width || 0) * (m.quantity || 1);
                return m2Real > 0 ? (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{m.name}</td>
                    <td style={{ textAlign: 'center', padding: '8px 12px' }}>{m2Real.toFixed(5)} m²</td>
                    <td style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 600 }}>{m.m2_budgeted ? `${m.m2_budgeted} m²` : '—'}</td>
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
