/**
 * Payment-methods catalogue table for PaymentMethodsPage.
 */
import React from 'react';
import { Edit, Trash2 } from 'lucide-react';
import type { PaymentMethod } from '../../../types/paymentMethod';
import styles from './PaymentMethodsTable.module.css';

const s = styles as unknown as Record<string, string>;

const TYPE_LABELS: Record<string, string> = {
  NONE: 'Sin cálculo',
  DISCOUNT: 'Descuento',
  SURCHARGE: 'Recargo',
};

const TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  NONE: { bg: '#e2e8f0', fg: '#334155' },
  DISCOUNT: { bg: '#dcfce7', fg: '#166534' },
  SURCHARGE: { bg: '#fee2e2', fg: '#991b1b' },
};

function formatValue(pm: PaymentMethod): string {
  if (pm.type === 'NONE' || !pm.value) return '—';
  const amount = pm.is_percentage ? `${pm.value}%` : `$${pm.value.toLocaleString('es-AR')}`;
  return pm.applies_to_installments ? `${amount} × cuota` : amount;
}

interface PaymentMethodsTableProps {
  data: PaymentMethod[];
  onEdit: (pm: PaymentMethod) => void;
  onDelete: (id: number) => void;
}

function PaymentMethodsTableInner({ data, onEdit, onDelete }: PaymentMethodsTableProps) {
  return (
    <div className="card">
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Etiqueta</th>
              <th>Identificador</th>
              <th>Tipo</th>
              <th>Valor</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data.map((pm) => {
              const colors = TYPE_COLORS[pm.type] || TYPE_COLORS.NONE;
              return (
                <tr key={pm.id}>
                  <td style={{ fontWeight: 600 }}>{pm.label}</td>
                  <td>
                    <code style={{ fontSize: 12, color: '#475569' }}>{pm.name}</code>
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{ background: colors.bg, color: colors.fg }}
                    >
                      {TYPE_LABELS[pm.type] || pm.type}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{formatValue(pm)}</td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: pm.is_active ? '#dbeafe' : '#f1f5f9',
                        color: pm.is_active ? '#1e40af' : '#64748b',
                      }}
                    >
                      {pm.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-outline" style={{ padding: '4px 8px' }} onClick={() => onEdit(pm)} title="Editar">
                        <Edit size={14} />
                      </button>
                      <button className="btn btn-danger" style={{ padding: '4px 8px' }} onClick={() => onDelete(pm.id)} title="Eliminar">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {(!data || data.length === 0) && (
              <tr>
                <td colSpan={6} className={s['pm-table__empty-row']}>
                  No hay métodos de pago configurados. Hacé click en "Nuevo Método de Pago" para empezar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const PaymentMethodsTable = React.memo(PaymentMethodsTableInner);
