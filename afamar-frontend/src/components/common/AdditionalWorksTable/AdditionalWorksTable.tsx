/**
 * Additional works catalogue table for AdditionalWorksPage.
 */

import React from 'react';
import { Edit, Trash2 } from 'lucide-react';
import { formatCurrencyValue } from '../../../utils/formatters';
import type { AdditionalWork } from '../../../types/additionalWork';
import styles from './AdditionalWorksTable.module.css';

const s = styles as unknown as Record<string, string>;

const TYPE_LABELS: Record<string, string> = {
  flat: 'Plano (cant. × precio)',
  frente: 'Frente / Regrueso (fórmula)',
};

interface AdditionalWorksTableProps {
  data: AdditionalWork[];
  onEdit: (a: AdditionalWork) => void;
  onDelete: (id: number) => void;
}

function AdditionalWorksTableInner({ data, 
onEdit, onDelete }: AdditionalWorksTableProps) {
  return (
    <div className="card">
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Detalle</th>
              <th>Tipo</th>
              <th>Precio</th>
              <th>Moneda</th>
              <th style={{ width: 160 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data.map((a) => (
              <tr key={a.id}>
                <td style={{ fontWeight: 600 }}>{a.name}</td>
                <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {a.detail || <span className={s['aw-table__detail-empty']}>—</span>}
                </td>
                <td>
                  <span
                    className="badge"
                    style={{
                      background: a.type === 'frente' ? '#fde68a' : '#e2e8f0',
                      color: a.type === 'frente' ? '#92400e' : '#334155',
                    }}
                    title={TYPE_LABELS[a.type || 'flat']}
                  >
                    {a.type === 'frente' ? 'Frente' : 'Plano'}
                  </span>
                  {a.type === 'frente' && a.formula_constant != null ? (
                    <span className={s['aw-table__multi-text']} title="Multiplicador aplicado al cálculo automático.">
                      (multiplicador {Number(a.formula_constant).toLocaleString('es-AR', { minimumFractionDigits: 2 })})
                    </span>
                  ) : null}
                </td>
                <td style={{ fontWeight: 600 }}>
                  {a.type === 'frente'
                    ? <span className={s['aw-table__auto-text']}>automático</span>
                    : formatCurrencyValue(Number(a.price || 0), { currency: a.currency as 'ARS' | 'USD' })}
                </td>
                <td>
                  <span
                    className="badge"
                    style={{
                      background: a.currency === 'USD' ? '#d1fae5' : '#dbeafe',
                      color: a.currency === 'USD' ? '#065f46' : '#1e40af',
                    }}
                  >
                    {a.currency}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-outline" style={{ padding: '4px 8px' }} onClick={() => onEdit(a)} title="Editar">
                      <Edit size={14} />
                    </button>
                    <button className="btn btn-danger" style={{ padding: '4px 8px' }} onClick={() => onDelete(a.id)} title="Eliminar">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {(!data || data.length === 0) && (
              <tr>
                <td colSpan={6} className={s['aw-table__empty-row']}>
                  No hay trabajos adicionales configurados. Hacé click en "Nuevo Trabajo Adicional" para empezar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const AdditionalWorksTable = React.memo(AdditionalWorksTableInner);
