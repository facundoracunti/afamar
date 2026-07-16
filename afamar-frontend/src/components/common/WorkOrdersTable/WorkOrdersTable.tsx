/**
 * Work orders table for WorkOrdersListPage.
 * Renders 14-column table with status advance, view, PDF, WhatsApp, delete actions.
 */

import React from 'react';
import { ChevronLeft, ChevronRight, Eye, FileDown, Send, Mail, Trash2 } from 'lucide-react';
import { orderStatuses, formatDate } from '../../../utils/formatters';
import CurrencyDisplay from '../../ui/CurrencyDisplay';
import { StatusBadge } from '../../ui/StatusBadge';
import { EmptyState } from '../../ui/EmptyState/EmptyState';
import type { WorkOrderListItem } from '../../../types/workOrder';
import styles from './WorkOrdersTable.module.css';

const s = styles as unknown as Record<string, string>;

interface WorkOrdersTableProps {
  data: WorkOrderListItem[];
  onView: (o: WorkOrderListItem) => void;
  onStatusAdvance: (o: WorkOrderListItem, direction: 1 | -1) => Promise<void>;
  onOpenPdf: (o: WorkOrderListItem) => Promise<void>;
  onWhatsApp: (o: WorkOrderListItem) => void;
  onDelete: (id: number) => void;
}

const btnCls = (variant?: 'success' | 'info' | 'danger'): string => {
  const base = s['wo-table__action-btn'];
  if (variant === 'success') return `${base} ${s['wo-table__action-btn--success']}`;
  if (variant === 'info') return `${base} ${s['wo-table__action-btn--info']}`;
  if (variant === 'danger') return `${base} ${s['wo-table__action-btn--danger']}`;
  return base;
};

export function WorkOrdersTable({
  data,
  onView,
  onStatusAdvance,
  onOpenPdf,
  onWhatsApp,
  onDelete,
}: WorkOrdersTableProps) {
  return (
    <div className={s['wo-table']}>
      <table>
        <thead>
          <tr>
            <th className={s['wo-table__th']} style={{ width: 100 }}>Número</th>
            <th className={s['wo-table__th']} style={{ width: 95 }}>Fecha</th>
            <th className={s['wo-table__th']}>Cliente</th>
            <th className={s['wo-table__th']} style={{ width: 120 }}>Teléfono</th>
            <th className={s['wo-table__th']}>Material</th>
            <th className={s['wo-table__th']} style={{ width: 110 }}>Total</th>
            <th className={s['wo-table__th']} style={{ width: 100 }}>Seña</th>
            <th className={s['wo-table__th']} style={{ width: 110 }}>Saldo</th>
            <th className={s['wo-table__th']} style={{ width: 110 }}>Entrega</th>
            <th className={s['wo-table__th']} style={{ width: 110 }}>Estado</th>
            <th className={s['wo-table__th']} style={{ width: 90 }}>Avanzar</th>
            <th className={s['wo-table__th']} style={{ width: 140 }}>Vista</th>
            <th className={s['wo-table__th']} style={{ width: 150 }}>Notificar</th>
            <th className={s['wo-table__th']} style={{ width: 70 }}>Eliminar</th>
          </tr>
        </thead>
        <tbody>
          {data.map((o: WorkOrderListItem) => {
            const statusIdx = orderStatuses.indexOf(o.status);
            const canBack = statusIdx > 0;
            const canForward = statusIdx >= 0 && statusIdx < orderStatuses.length - 1;
            const canWhatsApp = !!o.client_phone;
            return (
              <tr
                key={o.id}
                className={s['wo-table__row']}
                onClick={() => onView(o)}
              >
                <td className={s['wo-table__td']}>
                  <span className={s['wo-table__numero']}>{o.number}</span>
                </td>
                <td className={s['wo-table__td']}>
                  {formatDate((o.date || o.created_at || '').split('T')[0]) || '-'}
                </td>
                <td className={s['wo-table__td']}>{o.client_name || '-'}</td>
                <td className={s['wo-table__td']}>{o.client_phone || '-'}</td>
                <td className={s['wo-table__td'] + ' ' + s['wo-table__material']}>
                  {o.material || '-'}
                </td>
                <td className={s['wo-table__td'] + ' ' + s['wo-table__total-cell']}>
                  <CurrencyDisplay value={o.total} />
                </td>
                <td className={s['wo-table__td']}>
                  <CurrencyDisplay value={o.deposit_received} />
                </td>
                <td className={s['wo-table__td'] + ' ' + s['wo-table__total-cell']}>
                  <CurrencyDisplay value={o.balance_due} />
                </td>
                <td className={s['wo-table__td']}>
                  {formatDate(o.delivery_date || '') || '-'}
                </td>
                <td className={s['wo-table__td']}>
                  <StatusBadge status={o.status} />
                </td>

                <td
                  className={`${s['wo-table__td']} ${s['wo-table__actions-cell']}`}
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                >
                  <div className={s['wo-table__action-pair']}>
                    {canBack && (
                      <button
                        type="button"
                        className={btnCls()}
                        onClick={() => onStatusAdvance(o, -1)}
                        title="Retroceder estado"
                      >
                        <ChevronLeft size={12} />
                      </button>
                    )}
                    {canForward && (
                      <button
                        type="button"
                        className={btnCls('info')}
                        onClick={() => onStatusAdvance(o, 1)}
                        title="Avanzar estado"
                      >
                        <ChevronRight size={12} />
                      </button>
                    )}
                    {!canBack && !canForward && (
                      <span className={s['wo-table__action-dash']}>—</span>
                    )}
                  </div>
                </td>

                <td
                  className={`${s['wo-table__td']} ${s['wo-table__actions-cell']}`}
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                >
                  <div className={s['wo-table__action-pair']}>
                    <button type="button" className={btnCls()} onClick={() => onView(o)} title="Ver / editar">
                      <Eye size={12} /> Ver
                    </button>
                    <button type="button" className={btnCls()} onClick={() => onOpenPdf(o)} title="Vista previa del PDF">
                      <FileDown size={12} /> PDF
                    </button>
                  </div>
                </td>

                <td
                  className={`${s['wo-table__td']} ${s['wo-table__actions-cell']}`}
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                >
                  <div className={s['wo-table__action-pair']}>
                    <button
                      type="button"
                      className={canWhatsApp ? btnCls('success') : btnCls()}
                      onClick={canWhatsApp ? () => onWhatsApp(o) : undefined}
                      disabled={!canWhatsApp}
                      style={canWhatsApp ? undefined : { opacity: 0.4, cursor: 'not-allowed' }}
                      title={canWhatsApp ? `Enviar WhatsApp a ${o.client_phone}` : 'Sin teléfono cargado'}
                    >
                      <Send size={12} /> WhatsApp
                    </button>
                    <button
                      type="button"
                      className={btnCls('info')}
                      title="Enviar PDF por correo"
                      disabled
                      style={{ opacity: 0.4, cursor: 'not-allowed' }}
                    >
                      <Mail size={12} />Correo</button>
                  </div>
                </td>

                <td
                  className={`${s['wo-table__td']} ${s['wo-table__actions-cell']}`}
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className={btnCls('danger')}
                    onClick={() => onDelete(o.id)}
                    title="Eliminar orden"
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            );
          })}
          {data.length === 0 && (
            <tr><td colSpan={14}><EmptyState message="No hay órdenes de trabajo" /></td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
