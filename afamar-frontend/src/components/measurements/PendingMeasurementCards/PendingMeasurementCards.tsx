import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Ruler, ArrowRight } from 'lucide-react';
import type { WorkOrderListItem } from '../../../types/workOrder';
import { formatCurrency } from '../../../utils/formatters';
import { Pagination } from '../../ui/Pagination';
import styles from './PendingMeasurementCards.module.css';

const s = styles as unknown as Record<string, string>;

export type PendingMeasurementSort =
  | 'delivery_asc'
  | 'created_desc'
  | 'created_asc'
  | 'client_asc'
  | 'number_asc';

interface Props {
  orders: WorkOrderListItem[];
  loading?: boolean;
  total: number;
  page: number;
  pageSize: number;
  sort: PendingMeasurementSort;
  onPageChange: (page: number) => void;
  onSortChange: (sort: PendingMeasurementSort) => void;
  /** Modal mode: si está definido, se llama con el workOrderId en vez de navegar. */
  onCreateFromWo?: (workOrderId: number) => void;
}

/**
 * Card grid listing work orders currently in MEASUREMENT status. Clicking a
 * card navigates to the new-measurement form with `?workOrderId=ID` so the
 * form can pre-fill client, date and work-order fields from the source order.
 */
export default function PendingMeasurementCards({
  orders,
  loading,
  total,
  page,
  pageSize,
  sort,
  onPageChange,
  onSortChange,
  onCreateFromWo,
}: Props) {
  const navigate = useNavigate();
  const handleSelect = (woId: number) => {
    if (onCreateFromWo) onCreateFromWo(woId);
    else navigate(`/admin/measurements/new?workOrderId=${woId}`);
  };

  if (loading) return null;

  return (
    <section className={s['pending-measurements']}>
      <header className={s['pending-measurements__header']}>
        <div className={s['pending-measurements__heading']}>
          <h2 className={s['pending-measurements__title']}>
            <Ruler size={18} /> Órdenes pendientes de medición
          </h2>
          <span className={s['pending-measurements__count']}>{total}</span>
        </div>
        <label className={s['pending-measurements__sort']}>
          <span>Ordenar por</span>
          <select
            className={`input ${s['pending-measurements__sort-select']}`}
            value={sort}
            onChange={(e) => onSortChange(e.target.value as PendingMeasurementSort)}
          >
            <option value="delivery_asc">Entrega más próxima</option>
            <option value="created_desc">Más recientes</option>
            <option value="created_asc">Más antiguas</option>
            <option value="client_asc">Cliente A–Z</option>
            <option value="number_asc">Número de orden</option>
          </select>
        </label>
      </header>

      {orders.length === 0 ? (
        <div className={s['pending-measurements__empty']}>
          No hay órdenes pendientes de medición.
        </div>
      ) : (
        <div className={s['pending-measurements__grid']}>
        {orders.map((wo) => (
          <button
            key={wo.id}
            type="button"
            className={s['pending-measurements__card']}
            onClick={() => handleSelect(wo.id)}
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
      )}

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={onPageChange}
        label="órdenes pendientes"
      />
    </section>
  );
}