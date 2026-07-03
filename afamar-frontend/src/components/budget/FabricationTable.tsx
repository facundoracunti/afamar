// @ts-nocheck
import React from 'react';
import { Plus, X } from 'lucide-react';

interface FabricationTableProps {
  detalles: Record<string, unknown>[];
  readOnly: boolean;
  handleDetailChange: (i: number, field: string, value: unknown) => void;
  addDetalle: () => void;
  removeDetalle: (i: number) => void;
  materiales: Record<string, unknown>[];
  M2_CONCEPTS: string[];
  fabricationConcepts: string[];
  num: (v: unknown) => number;
}

// FabricationDetail uses Spanish field names internally (concepto, detalle, etc.)
// because the backend serializes fabrication_details as a JSON string column, not typed fields.
export default function FabricationTable({ detalles, readOnly, handleDetailChange, addDetalle, removeDetalle, materiales, M2_CONCEPTS, fabricationConcepts, num }: FabricationTableProps) {
  return (
    <>
      <h3 className="section-title">DETALLE DE FABRICACIÓN Y ADICIONALES</h3>
      <table className="table" style={{ fontSize: 13 }}>
        <thead>
          <tr>
            <th>Concepto</th>
            <th>Material</th>
            <th>Detalle</th>
            <th style={{ width: 100 }}>Precio</th>
            <th style={{ width: 50 }}>Cant</th>
            <th style={{ width: 30 }}></th>
          </tr>
        </thead>
        <tbody>
          {detalles.map((d, i) => (
            <tr key={i}>
              <td>
                <select className="input" style={{ fontSize: 12, padding: '4px 8px' }} value={d.concepto as string} onChange={(e) => handleDetailChange(i, 'concepto', e.target.value)} disabled={readOnly}>
                  {fabricationConcepts.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </td>
              <td>
                {M2_CONCEPTS.includes(d.concepto as string) ? (
                  <select className="input" style={{ fontSize: 11, padding: '4px 4px' }} value={d.material as string || ''} onChange={(e) => handleDetailChange(i, 'material', e.target.value)} disabled={readOnly}>
                    <option value="">--</option>
                    {materiales.map((m: Record<string, unknown>) => <option key={m.id as number} value={m.name as string}>{m.name as string}</option>)}
                  </select>
                ) : null}
              </td>
              <td>
                {M2_CONCEPTS.includes(d.concepto as string) ? (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input className="input" type="number" step="0.01" min="0" style={{ fontSize: 12, padding: '4px 8px', width: '30%' }} value={d.largo ?? ''} onChange={(e) => handleDetailChange(i, 'largo', num(e.target.value))} placeholder="Largo" disabled={readOnly} />
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>×</span>
                    <input className="input" type="number" step="0.01" min="0" style={{ fontSize: 12, padding: '4px 8px', width: '30%' }} value={d.ancho ?? ''} onChange={(e) => handleDetailChange(i, 'ancho', num(e.target.value))} placeholder="Ancho" disabled={readOnly} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#1e40af', whiteSpace: 'nowrap' }}>{(d.m2 || 0)} m²</span>
                  </div>
                ) : d.concepto === 'OTRA' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <input className="input" style={{ fontSize: 12, padding: '4px 8px' }} value={d.detalle as string} onChange={(e) => handleDetailChange(i, 'detalle', e.target.value)} placeholder="DETALLES" disabled={readOnly} />
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <input className="input" type="number" step="0.01" min="0" style={{ fontSize: 12, padding: '4px 8px', width: '35%' }} value={d.largo ?? ''} onChange={(e) => handleDetailChange(i, 'largo', num(e.target.value))} placeholder="Largo" disabled={readOnly} />
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>×</span>
                      <input className="input" type="number" step="0.01" min="0" style={{ fontSize: 12, padding: '4px 8px', width: '35%' }} value={d.mano_de_obra ?? ''} onChange={(e) => handleDetailChange(i, 'mano_de_obra', num(e.target.value))} placeholder="Mano de obra" disabled={readOnly} />
                    </div>
                  </div>
                ) : (
                  <input className="input" style={{ fontSize: 12, padding: '4px 8px' }} value={d.detalle as string} onChange={(e) => handleDetailChange(i, 'detalle', e.target.value)} placeholder="Cant / ML / cm" disabled={readOnly} />
                )}
              </td>
              <td>
                {M2_CONCEPTS.includes(d.concepto as string) ? (
                  <span style={{ fontSize: 12, fontWeight: 600, color: (d.moneda as string) === 'USD' ? '#059669' : '#1e293b' }}>{(d.moneda as string) === 'USD' ? 'USD ' : '$'}{Number(d.precio || 0).toLocaleString('es-AR')}</span>
                ) : d.concepto === 'OTRA' ? (
                  <span style={{ fontSize: 12, fontWeight: 600, color: (d.moneda as string) === 'USD' ? '#059669' : '#1e293b' }}>{(d.moneda as string) === 'USD' ? 'USD ' : '$'}{Number(d.precio || 0).toLocaleString('es-AR')}</span>
                ) : ['TRAFORO DE PILETA', 'TRAFORO DE ANAFE', 'TRAFORO DE PILETA DE APOYO'].includes(d.concepto as string) ? (
                  <input className="input" type="number" step="0.01" min="0" style={{ fontSize: 12, padding: '4px 8px', width: '100%' }} value={d.precio || ''} onChange={(e) => handleDetailChange(i, 'precio', num(e.target.value))} placeholder="0" disabled={readOnly} />
                ) : (
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>-</span>
                )}
              </td>
              <td>
                <input className="input" type="number" min="1" style={{ width: 45, fontSize: 12, padding: '4px 6px' }}
                  value={d.cantidad || 1} onChange={(e) => handleDetailChange(i, 'cantidad', num(e.target.value))} disabled={readOnly} />
              </td>
              <td>
                <button type="button" className="btn btn-outline" style={{ padding: '2px 6px' }} onClick={() => removeDetalle(i)} disabled={readOnly}>
                  <X size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn btn-outline" onClick={addDetalle} style={{ marginTop: 8, fontSize: 13, padding: '6px 14px' }} disabled={readOnly}>
        <Plus size={14} /> Agregar concepto
      </button>
    </>
  );
}
