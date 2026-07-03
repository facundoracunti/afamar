import React from 'react';
import { formatCurrency, fabricationConcepts } from '../../utils/formatters';
import FabricationTable from '../../components/budget/FabricationTable';
import type { EntityFormState, MaterialInForm } from '../../types';

interface WorkOrderFormItemsGridProps {
  form: EntityFormState;
  readOnly: boolean;
  materiales: Record<string, unknown>[];
  M2_CONCEPTS: string[];
  num: (v: string) => number | null;
  handleDetailChange: (idx: number, field: string, value: unknown) => void;
  addDetalle: () => void;
  removeDetalle: (idx: number) => void;
}

export default function WorkOrderFormItemsGrid({
  form,
  readOnly,
  materiales,
  M2_CONCEPTS,
  num,
  handleDetailChange,
  addDetalle,
  removeDetalle,
}: WorkOrderFormItemsGridProps) {
  const materialsData = form.materials_data as unknown as MaterialInForm[];
  return (
    <div className="card">
      <FabricationTable
        detalles={form.fabrication_details as unknown as Record<string, unknown>[]}
        readOnly={readOnly}
        handleDetailChange={handleDetailChange}
        addDetalle={addDetalle}
        removeDetalle={removeDetalle}
        materiales={materiales}
        M2_CONCEPTS={M2_CONCEPTS}
        fabricationConcepts={fabricationConcepts}
        num={num as (v: unknown) => number}
      />

      {form.status === 'MEASUREMENT' && (materialsData || []).length > 0 && (
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
                    <td style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 600 }}>{m.m2Budgeted ? `${m.m2Budgeted} m²` : '—'}</td>
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