import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Ruler, ArrowRight } from 'lucide-react';
import type { WorkOrderListItem } from '../../../types/workOrder';
import { formatCurrency } from '../../../utils/formatters';
import styles from './PendingMeasurementCards.module.css';

const s = styles as unknown as Record<string, string>;

interface Props {
  orders: WorkOrderListItem[];
  loading?: boolean;
}

/**
 * Card grid listing work orders currently in MEASUREMENT status. Clicking a
 * card navigates to the new-measurement form with `?workOrderId=ID` so the
 * form can pre-fill client, date and work-order fields from the source order.
 */
export default function PendingMeasurementCards({ orders, loading }: Props) {
  const navigate = useNavigate();

  if (loading) return null;

  if (orders.length === 0) {
    return (
      <section className={s['pending-measurements']}>
        <header className={s['pending-measurements__header']}>
          <h2 className={s['pending-measurements__title']}>
            <Ruler size={18} /> Órdenes pendientes de medición
          </h2>
        </header>
        <div className={s['pending-measurements__empty']}>
          No hay órdenes pendientes de medición.
        </div>
      </section>
    );
  }

  return (
    <section className={s['pending-measurements']}>
      <header className={s['pending-measurements__header']}>
        <h2 className={s['pending-measurements__title']}>
          <Ruler size={18} /> Órdenes pendientes de medición
        </h2>
        <span className={s['pending-measurements__count']}>{orders.length}</span>
      </header>

      <div className={s['pending-measurements__grid']}>
        {orders.map((wo) => (
          <button
            key={wo.id}
            type="button"
            className={s['pending-measurements__card']}
            onClick={() => navigate(`/admin/measurements/new?workOrderId=${wo.id}`)}
            aria-label={`Crear medición para la orden ${wo.number}`}
          >
            <div className={s['pending-measurements__card-header']}>
              <span className={s['pending-measurements__number']}>{wo.number}</span>
              <ArrowRight size={16} className={s['pending-measurements__arrow']} />
            </div>

            <div className={s['pending-measurements__client']}>
              {wo.client_name || 'Sin cliente'}
            </div>

            {wo.material && (
              <div className={s['pending-measurements__material']}>
                {wo.material}
              </div>
            )}

            <div className={s['pending-measurements__meta']}>
              <span className={s['pending-measurements__total']}>
                {formatCurrency(wo.total)}
              </span>
              {wo.delivery_date && (
                <span className={s['pending-measurements__date']}>
                  Entrega: {wo.delivery_date.split('T')[0]}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}