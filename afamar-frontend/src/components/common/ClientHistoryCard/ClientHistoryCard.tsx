/**
 * Client history section: stats, associated budgets, associated work orders.
 * Rendered on the right side of ClientFormPage in edit mode.
 */

import { FileText, ClipboardList, DollarSign, Calendar, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCurrencyValue } from '../../../utils/formatters';
import { StatusBadge } from '../../ui/StatusBadge';
import type { Client } from '../../../types/client';
import styles from './ClientHistoryCard.module.css';

const s = styles as unknown as Record<string, string>;

interface HistoryData {
  total_budgets: number;
  total_orders: number;
  total_purchased: number;
  last_order: string | null;
  orders: Record<string, unknown>[];
  budgets: Record<string, unknown>[];
  created_at: string;
}

interface ClientHistoryCardProps {
  clientData: Record<string, unknown>;
  client: Client | undefined;
}

function formatCurrency(n: number): string {
  return formatCurrencyValue(n, { currency: 'ARS' });
}

export function ClientHistoryCard({ clientData, client }: ClientHistoryCardProps) {
  const navigate = useNavigate();

  const historial: HistoryData | null = clientData
    ? {
        total_budgets: (clientData.total_budgets as number) || 0,
        total_orders: (clientData.total_orders as number) || 0,
        total_purchased: (clientData.total_purchased as number) || 0,
        last_order: clientData.last_order_number as string | null,
        orders: (clientData.orders as Record<string, unknown>[]) || [],
        budgets: (clientData.budgets as Record<string, unknown>[]) || [],
        created_at: clientData.created_at as string,
      }
    : null;

  if (!historial) return null;

  return (
    <div className={`${s['client-history']} ${s['client-history__card']} ${s['client-history__card--fill']}`}>
      <h3 className={s['client-history__section']}>Historial del cliente</h3>
      <div className={s['client-history__stats']}>
        <div className={s['client-history__stat']}>
          <FileText size={20} color="#3b82f6" className={s['client-history__stat-icon']} />
          <div className={s['client-history__stat-value']}>{historial.total_budgets}</div>
          <div className={s['client-history__stat-label']}>Presupuestos</div>
        </div>
        <div className={s['client-history__stat']}>
          <ClipboardList size={20} color="#059669" className={s['client-history__stat-icon']} />
          <div className={s['client-history__stat-value']}>{historial.total_orders}</div>
          <div className={s['client-history__stat-label']}>Órdenes</div>
        </div>
        <div className={s['client-history__stat']}>
          <DollarSign size={20} color="#d97706" className={s['client-history__stat-icon']} />
          <div className={s['client-history__stat-value']}>{formatCurrency(historial.total_purchased)}</div>
          <div className={s['client-history__stat-label']}>Total facturado</div>
        </div>
        <div className={s['client-history__stat']}>
          <Calendar size={20} color="#8b5cf6" className={s['client-history__stat-icon']} />
          <div className={s['client-history__stat-value']}>{historial.last_order || '-'}</div>
          <div className={s['client-history__stat-label']}>Última orden</div>
        </div>
      </div>

      <h4 className={s['client-history__sub-section']}>Presupuestos asociados</h4>
      {historial.budgets.length > 0 ? (
        <div className={s['client-history__items-list']}>
          {historial.budgets.map((b) => (
            <div
              key={b.number as string}
              className={s['client-history__item']}
              onClick={() => navigate(`/admin/budgets/${b.id as number}`)}
            >
              <div className={s['client-history__item-left']}>
                <span className={s['client-history__item-num']}>{b.number as string}</span>
                <StatusBadge status={b.status as string} />
              </div>
              <div className={s['client-history__item-right']}>
                <span className={s['client-history__item-total']}>
                  {formatCurrencyValue(Number((b.total as number) || 0), { decimals: 0 })}
                </span>
                <ArrowRight size={14} color="#94a3b8" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={s['client-history__item-empty']}>Sin presupuestos asociados.</div>
      )}

      <h4 className={s['client-history__sub-section']}>Órdenes asociadas</h4>
      {historial.orders.length > 0 ? (
        <div className={s['client-history__items-list']}>
          {historial.orders.map((o) => (
            <div
              key={o.number as string}
              className={s['client-history__item']}
              onClick={() => navigate(`/admin/work-orders/${o.id as number}`)}
            >
              <div className={s['client-history__item-left']}>
                <span className={s['client-history__item-num']}>{o.number as string}</span>
                <StatusBadge status={o.status as string} />
              </div>
              <div className={s['client-history__item-right']}>
                <span className={s['client-history__item-total']}>
                  {formatCurrencyValue(Number((o.total as number) || 0), { decimals: 0 })}
                </span>
                <ArrowRight size={14} color="#94a3b8" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={s['client-history__item-empty']}>Sin órdenes asociadas.</div>
      )}
    </div>
  );
}
