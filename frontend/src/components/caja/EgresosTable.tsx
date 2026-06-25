import React from 'react';
import { Trash2, ArrowDownCircle, Plus } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

interface Props {
  egresos: Record<string, unknown>[];
  cerrada: boolean;
  onDelete: (id: number) => void;
  onAdd: () => void;
}

export default function EgresosTable({ egresos, cerrada, onDelete, onAdd }: Props) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' } as React.CSSProperties}>
      <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } as React.CSSProperties}>
        <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626' } as React.CSSProperties}>
          <ArrowDownCircle size={20} /> Salidas (Egresos)
        </h3>
        <button className="btn btn-danger no-print" style={{ padding: '6px 12px', fontSize: 13 } as React.CSSProperties}
          disabled={cerrada} onClick={onAdd}>
          <Plus size={14} /> Agregar Egreso
        </button>
      </div>
      <div className="table-container" style={{ marginTop: 12 } as React.CSSProperties}>
        <table>
          <thead>
            <tr>
              <th>Concepto</th>
              <th style={{ width: 110 } as React.CSSProperties}>Monto</th>
              <th style={{ width: 90 } as React.CSSProperties}>Tipo</th>
              <th className="no-print" style={{ width: 40 } as React.CSSProperties}></th>
            </tr>
          </thead>
          <tbody>
            {egresos.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' } as React.CSSProperties}>Sin egresos registrados</td></tr>
            ) : (
              egresos.map((m: Record<string, unknown>) => (
                <tr key={m.id as number}>
                  <td>{(m.concepto as string) || '-'}</td>
                  <td style={{ fontWeight: 600, color: '#dc2626' } as React.CSSProperties}>{formatCurrency(m.monto as number)}</td>
                  <td>
                    <span className={`badge ${(m.tipo_egreso as string) === 'Gasto' ? 'badge-rejected' : 'badge-production'}`}>
                      {(m.tipo_egreso as string) || 'Gasto'}
                    </span>
                  </td>
                  <td className="no-print">
                    <button className="btn" style={{ padding: '3px 6px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' } as React.CSSProperties}
                      onClick={() => onDelete(m.id as number)} title="Eliminar">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
