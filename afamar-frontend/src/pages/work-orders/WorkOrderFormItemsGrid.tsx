import React from 'react';
import { formatCurrency, conceptosFabricacion } from '../../utils/formatters';
import FabricacionTable from '../../components/presupuesto/FabricacionTable';
import type { EntityFormState } from '../../types';

interface WorkOrderFormItemsGridProps {
  form: EntityFormState;
  readOnly: boolean;
  materiales: Record<string, unknown>[];
  CONCEPTOS_M2: string[];
  num: (v: string) => number | null;
  handleDetalleChange: (idx: number, field: string, value: unknown) => void;
  addDetalle: () => void;
  removeDetalle: (idx: number) => void;
}

export default function WorkOrderFormItemsGrid({
  form,
  readOnly,
  materiales,
  CONCEPTOS_M2,
  num,
  handleDetalleChange,
  addDetalle,
  removeDetalle,
}: WorkOrderFormItemsGridProps) {
  return (
    <div className="card">
      <FabricacionTable
        detalles={form.detalles_fabricacion as unknown as Record<string, unknown>[]}
        readOnly={readOnly}
        handleDetalleChange={handleDetalleChange}
        addDetalle={addDetalle}
        removeDetalle={removeDetalle}
        materiales={materiales}
        CONCEPTOS_M2={CONCEPTOS_M2}
        conceptosFabricacion={conceptosFabricacion}
        num={num as (v: unknown) => number}
      />

      {form.estado === 'MEDICION' && form.detalles_presupuestados.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>📐 COMPARATIVA DE MEDICIÓN</h4>
          <table className="table" style={{ fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px' }}>Concepto</th>
                <th style={{ textAlign: 'center', padding: '8px 12px' }}>M² Presupuestado</th>
                <th style={{ textAlign: 'center', padding: '8px 12px' }}>M² Medición Real</th>
                <th style={{ textAlign: 'center', padding: '8px 12px' }}>Diferencia Δ</th>
              </tr>
            </thead>
            <tbody>
              {form.detalles_fabricacion.map((d, i) => {
                if (!CONCEPTOS_M2.includes(d.concepto)) return null;
                const pres = form.detalles_presupuestados[i];
                if (!pres) return null;
                const m2Ori = Number(pres.m2) || 0;
                const m2Real = d.m2 || 0;
                const dif = Math.round((m2Real - m2Ori) * 100000) / 100000;
                const difColor = dif > 0 ? '#16a34a' : dif < 0 ? '#dc2626' : '#6b7280';
                return (
                  <tr key={'med_' + i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{d.concepto === 'OTRA' ? (d.detalle || 'OTRA') : d.concepto}</td>
                    <td style={{ textAlign: 'center', padding: '8px 12px' }}>{m2Ori.toFixed(5)} m²</td>
                    <td style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 600 }}>{m2Real.toFixed(5)} m²</td>
                    <td style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 700, color: difColor }}>
                      {dif > 0 ? '+' : ''}{dif.toFixed(5)} m²
                    </td>
                  </tr>
                );
              })}
              {(form.materiales || []).filter((m) => Number(m.largo || 0) * Number(m.ancho || 0) > 0).map((m, i) => {
                const m2Real = Number(m.largo || 0) * Number(m.ancho || 0) * (m.cantidad || 1);
                const m2Pres = m.m2_presupuestado || 0;
                const dif = Math.round((m2Real - m2Pres) * 100000) / 100000;
                const difColor = dif > 0 ? '#16a34a' : dif < 0 ? '#dc2626' : '#6b7280';
                return (
                  <tr key={'mat_' + i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{m.nombre}</td>
                    <td style={{ textAlign: 'center', padding: '8px 12px' }}>{m2Pres.toFixed(5)} m²</td>
                    <td style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 600 }}>{m2Real.toFixed(5)} m²</td>
                    <td style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 700, color: difColor }}>
                      {dif > 0 ? '+' : ''}{dif.toFixed(5)} m²
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