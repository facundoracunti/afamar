import React from 'react';
import { Trash2, ArrowUpCircle, Plus } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { estadoCarpetaClass } from './cajaUtils';

interface Props {
  ingresos: Record<string, unknown>[];
  cerrada: boolean;
  onDelete: (id: number) => void;
  onAdd: () => void;
}

export default function IngresosTable({ ingresos, cerrada, onDelete, onAdd }: Props) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' } as React.CSSProperties}>
      <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } as React.CSSProperties}>
        <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a' } as React.CSSProperties}>
          <ArrowUpCircle size={20} /> Entradas (Ingresos)
        </h3>
        <button className="btn btn-success no-print" style={{ padding: '6px 12px', fontSize: 13 } as React.CSSProperties}
          disabled={cerrada} onClick={onAdd}>
          <Plus size={14} /> Agregar Ingreso
        </button>
      </div>
      <div className="table-container" style={{ marginTop: 12 } as React.CSSProperties}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 90 } as React.CSSProperties}>N° Orden</th>
              <th>Cliente</th>
              <th style={{ width: 110 } as React.CSSProperties}>Monto</th>
              <th style={{ width: 110 } as React.CSSProperties}>Saldo Restante</th>
              <th style={{ width: 100 } as React.CSSProperties}>Pago</th>
              <th style={{ width: 90 } as React.CSSProperties}>Carpeta</th>
              <th className="no-print" style={{ width: 40 } as React.CSSProperties}></th>
            </tr>
          </thead>
          <tbody>
            {ingresos.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' } as React.CSSProperties}>Sin ingresos registrados</td></tr>
            ) : (
              ingresos.map((m: Record<string, unknown>) => (
                <tr key={m.id as number}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600 } as React.CSSProperties}>{(m.order_number as string) || '-'}</td>
                  <td>{(m.client_name as string) || '-'}</td>
                  <td style={{ fontWeight: 600, color: '#16a34a' } as React.CSSProperties}>{formatCurrency(m.amount as number)}</td>
                  <td style={{ fontWeight: 600, color: (m.remaining_balance as number) > 0 ? '#dc2626' : '#94a3b8' } as React.CSSProperties}>
                    {m.remaining_balance !== null && m.remaining_balance !== undefined ? formatCurrency(m.remaining_balance as number) : '-'}
                  </td>
                  <td>
                    <span className={`badge ${(m.payment_method as string) === 'CASH' ? 'badge-approved' : (m.payment_method as string) === 'TRANSFER' ? 'badge-production' : 'badge-pending'}`}>
                      {(m.payment_method as string) || '-'}
                    </span>
                  </td>
                  <td>
                    {m.folder_status ? (
                      <span className={`badge ${estadoCarpetaClass(m.folder_status as string)}`}>{(m.folder_status as string)}</span>
                    ) : '-'}
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
