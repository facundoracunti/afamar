// @ts-nocheck
import React from 'react';
import { Plus, X } from 'lucide-react';
import { t } from '../../../utils/translate';

interface FabricationTableProps {
  detalles: Record<string, unknown>[];
  readOnly: boolean;
  handleDetailChange: (i: number, field: string, value: unknown) => void;
  addDetalle: () => void;
  removeDetalle: (i: number) => void;
  materials: Record<string, unknown>[];
  M2_CONCEPTS: string[];
  fabricationConcepts: string[];
  num: (v: unknown) => number;
}

// FabricationDetail uses Spanish field names internally (concepto, detalle, etc.)
// because the backend serializes fabrication_details as a JSON string column, not typed fields.
export default function FabricationTable({ detalles, readOnly, handleDetailChange, addDetalle, removeDetalle, materials, M2_CONCEPTS, fabricationConcepts, num }: FabricationTableProps) {
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
                <select className="input" style={{ fontSize: 12, padding: '4px 8px' }} value={d.concept as string} onChange={(e) => handleDetailChange(i, 'concept', e.target.value)} disabled={readOnly}>
                  {fabricationConcepts.map((c) => <option key={c} value={c}>{t(c)}</option>)}
                </select>
              </td>
              <td>
                {M2_CONCEPTS.includes(d.concept as string) ? (
                  <select className="input" style={{ fontSize: 11, padding: '4px 4px' }} value={d.material as string || ''} onChange={(e) => handleDetailChange(i, 'material', e.target.value)} disabled={readOnly}>
                    <option value="">--</option>
                    {materials.map((m: Record<string, unknown>) => <option key={m.id as number} value={m.name as string}>{m.name as string}</option>)}
                  </select>
                ) : null}
              </td>
              <td>
                {M2_CONCEPTS.includes(d.concept as string) ? (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input className="input" type="number" step="0.01" min="0" style={{ fontSize: 12, padding: '4px 8px', width: '30%' }} value={d.length ?? ''} onChange={(e) => handleDetailChange(i, 'length', num(e.target.value))} placeholder="Largo" disabled={readOnly} />
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>×</span>
                    <input className="input" type="number" step="0.01" min="0" style={{ fontSize: 12, padding: '4px 8px', width: '30%' }} value={d.width ?? ''} onChange={(e) => handleDetailChange(i, 'width', num(e.target.value))} placeholder="Ancho" disabled={readOnly} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#1e40af', whiteSpace: 'nowrap' }}>{(d.m2 || 0)} m²</span>
                  </div>
                ) : d.concept === 'OTHER' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <input className="input" style={{ fontSize: 12, padding: '4px 8px' }} value={d.detail as string} onChange={(e) => handleDetailChange(i, 'detail', e.target.value)} placeholder="DETALLES" disabled={readOnly} />
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <input className="input" type="number" step="0.01" min="0" style={{ fontSize: 12, padding: '4px 8px', width: '35%' }} value={d.length ?? ''} onChange={(e) => handleDetailChange(i, 'length', num(e.target.value))} placeholder="Largo" disabled={readOnly} />
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>×</span>
                      <input className="input" type="number" step="0.01" min="0" style={{ fontSize: 12, padding: '4px 8px', width: '35%' }} value={d.labor ?? ''} onChange={(e) => handleDetailChange(i, 'labor', num(e.target.value))} placeholder="Mano de obra" disabled={readOnly} />
                    </div>
                  </div>
                ) : (
                  <input className="input" style={{ fontSize: 12, padding: '4px 8px' }} value={d.detail as string} onChange={(e) => handleDetailChange(i, 'detail', e.target.value)} placeholder="Cant / ML / cm" disabled={readOnly} />
                )}
              </td>
              <td>
                {M2_CONCEPTS.includes(d.concept as string) ? (
                  <span style={{ fontSize: 12, fontWeight: 600, color: (d.currency as string) === 'USD' ? '#059669' : '#64748b' }}>{(d.currency as string) === 'USD' ? 'USD ' : '$'}{Number(d.price || 0).toLocaleString('es-AR')}</span>
                ) : d.concept === 'OTHER' ? (
                  <span style={{ fontSize: 12, fontWeight: 600, color: (d.currency as string) === 'USD' ? '#059669' : '#64748b' }}>{(d.currency as string) === 'USD' ? 'USD ' : '$'}{Number(d.price || 0).toLocaleString('es-AR')}</span>
                ) : ['CUTOUT_SINK', 'CUTOUT_COOKTOP', 'CUTOUT_DROPIN_SINK'].includes(d.concept as string) ? (
                  <input className="input" type="number" step="0.01" min="0" style={{ fontSize: 12, padding: '4px 8px', width: '100%' }} value={d.price || ''} onChange={(e) => handleDetailChange(i, 'price', num(e.target.value))} placeholder="0" disabled={readOnly} />
                ) : (
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>-</span>
                )}
              </td>
              <td>
                <input className="input" type="number" min="1" style={{ width: 45, fontSize: 12, padding: '4px 6px' }}
                  value={d.quantity || 1} onChange={(e) => handleDetailChange(i, 'quantity', num(e.target.value))} disabled={readOnly} />
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