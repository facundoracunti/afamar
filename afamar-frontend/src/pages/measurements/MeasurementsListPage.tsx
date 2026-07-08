import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, Trash2, ArrowUp, ArrowDown, ArrowUpDown, CalendarDays } from 'lucide-react';
import { getMeasurements, deleteMeasurement } from '@/api/resources/measurements';
import { getWorkOrders } from '@/api/resources/workOrders';
import { useList, useDelete, useGet } from '../../api/hooks';
import { measurementStatuses, formatDate, todayLocalISO } from '../../utils/formatters';
import { t } from '../../utils/translate';
import { StatusBadge } from '../../components/ui/StatusBadge';
import type { Measurement } from '../../types/measurement';
import type { WorkOrderListItem } from '../../types/workOrder';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import { PageHeader } from '../../components/ui/PageHeader/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput/SearchInput';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import PendingMeasurementCards from '../../components/measurements/PendingMeasurementCards/PendingMeasurementCards';
import styles from './MeasurementsListPage.module.css';

const s = styles as unknown as Record<string, string>;

const MEASUREMENTS_KEY = ['measurements'] as const;

/** Columns the user can sort the measurements table by. The `Measurement`
 *  field name is used directly so the sorter just does `a[field] vs b[field]`
 *  without mapping (date/time strings sort correctly in ISO format). */
type SortField = 'client_name' | 'client_phone' | 'client_address' | 'scheduled_date' | 'scheduled_time' | 'status';
type SortDir = 'asc' | 'desc';

interface SortHeaderProps {
  field: SortField;
  label: string;
  currentField: SortField;
  currentDir: SortDir;
  onSort: (field: SortField) => void;
  style?: React.CSSProperties;
}

/** Clickable table header that toggles asc/desc on click. Renders an
 *  arrow indicator next to the label so the user knows which column is
 *  active and in which direction. */
function SortHeader({ field, label, currentField, currentDir, onSort, style }: SortHeaderProps) {
  const isActive = currentField === field;
  const Icon = !isActive ? ArrowUpDown : currentDir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      onClick={() => onSort(field)}
      className={s['measurements__th-sortable']}
      style={style}
      aria-sort={isActive ? (currentDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <span className={s['measurements__th-label']}>{label}</span>
      <Icon size={12} className={s['measurements__sort-icon']} aria-hidden="true" />
    </th>
  );
}

export default function MeasurementsList() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  // Default the date filter to today so the user lands on a working
  // agenda view (like CashDailyPage does). Empty string means "no date
  // filter — show every measurement".
  const [dateFilter, setDateFilter] = useState<string>(todayLocalISO());
  const [dateFilterEnabled, setDateFilterEnabled] = useState<boolean>(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  // Default to "fecha asc" — chronological, the most useful ordering for
  // an agenda view. Toggling a column flips the direction.
  const [sortField, setSortField] = useState<SortField>('scheduled_date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const navigate = useNavigate();

  const { items: data, loading } = useList<Measurement>(
    [...MEASUREMENTS_KEY, search, statusFilter, dateFilter, dateFilterEnabled],
    async () => {
      const res = await getMeasurements({
        search: search || undefined,
        status: statusFilter || undefined,
        scheduled_date: dateFilterEnabled ? dateFilter : undefined,
      });
      return (res.data as Measurement[]) || [];
    }
  );

  const deleteMutation = useDelete<unknown, number>(
    MEASUREMENTS_KEY,
    async (id) => { await deleteMeasurement(id); },
    { invalidateKeys: [MEASUREMENTS_KEY] }
  );

  // Work orders currently in MEASUREMENT status — surfaced as clickable cards
  // above the main table so the user can start a new measurement in one click.
  const { data: pendingOrders, loading: pendingLoading } = useGet<WorkOrderListItem[]>(
    ['work-orders', 'pending-measurement'],
    async () => {
      const res = await getWorkOrders({ status: 'MEASUREMENT', limit: 100 });
      return (res.data as WorkOrderListItem[]) || [];
    }
  );

  /**
   * Work-order ids that already have a NON-CANCELLED measurement scheduled
   * (PENDING or DONE). The cards above only show orders that still need a
   * measurement — once one is scheduled, the order disappears from the
   * cards (it lives in the measurements table below instead).
   *
   * Cancelled measurements don't count: the user cancelled that
   * measurement, the order is back to needing one, so the card must
   * re-appear.
   */
  const scheduledWorkOrderIds = useMemo(() => {
    const ids = new Set<number>();
    for (const m of data) {
      if (m.work_order_id && m.status !== 'CANCELLED') ids.add(m.work_order_id);
    }
    return ids;
  }, [data]);

  const unscheduledOrders = useMemo(
    () => (pendingOrders || []).filter((wo) => !scheduledWorkOrderIds.has(wo.id)),
    [pendingOrders, scheduledWorkOrderIds],
  );

  const handleDelete = async (): Promise<void> => {
    if (!deleteId) return;
    await deleteMutation.mutateAsync(deleteId);
    setDeleteId(null);
  };

  const handleSort = (field: SortField): void => {
    if (sortField === field) {
      // Same column → flip direction.
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      // New column → reset to ascending.
      setSortField(field);
      setSortDir('asc');
    }
  };

  /**
   * Sort the measurements table by the active column / direction. Empty
   * values are pushed to the bottom regardless of direction (otherwise
   * a missing `client_name` would float to the top just because empty
   * string compares less than everything).
   *
   * No `work_order_id` filter here — the agenda table shows EVERY
   * measurement the user scheduled (including the ones already linked
   * to a WO). The work-order side is the one filtered: see the
   * `PendingMeasurementCards` component which hides orders that already
   * have a scheduled measurement.
   */
  const visibleRows = useMemo(() => {
    const sorted = [...data].sort((a, b) => {
      const rawA = (a[sortField] ?? '') as string;
      const rawB = (b[sortField] ?? '') as string;
      const aEmpty = rawA === '' || rawA == null;
      const bEmpty = rawB === '' || rawB == null;
      if (aEmpty && !bEmpty) return 1;
      if (!aEmpty && bEmpty) return -1;
      if (aEmpty && bEmpty) return 0;
      let cmp = 0;
      if (rawA < rawB) cmp = -1;
      else if (rawA > rawB) cmp = 1;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [data, sortField, sortDir]);

  return (
    <div className={s['measurements']}>
      <PageHeader
        title="Agenda de Medición"
        actions={
          <button className="btn btn-primary" onClick={() => navigate('/admin/measurements/new')}>
            <Plus size={16} /> Nueva Medición
          </button>
        }
      />

      <PendingMeasurementCards orders={unscheduledOrders} loading={pendingLoading} />

      <div className={s['measurements__filters']}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por cliente, teléfono o dirección..."
          leftIcon={<Search size={18} />}
        />
        <div className={s['measurements__date-group']}>
          <CalendarDays size={16} className={s['measurements__date-icon']} aria-hidden="true" />
          <input
            type="date"
            className={`input ${s['measurements__filter']}`}
            value={dateFilter}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setDateFilter(e.target.value);
              setDateFilterEnabled(true);
            }}
            disabled={!dateFilterEnabled}
            aria-label="Fecha de la agenda"
          />
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              setDateFilter(todayLocalISO());
              setDateFilterEnabled(true);
            }}
            title="Ir a hoy"
          >
            Hoy
          </button>
          <button
            type="button"
            className={`btn ${dateFilterEnabled ? 'btn-outline' : 'btn-primary'}`}
            onClick={() => setDateFilterEnabled((v) => !v)}
            title={dateFilterEnabled ? 'Mostrar todas las mediciones' : 'Filtrar por día'}
          >
            {dateFilterEnabled ? 'Todas' : 'Filtrar por día'}
          </button>
        </div>
        <select
          className={`input ${s['measurements__filter']}`}
          value={statusFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {measurementStatuses.map((e: string) => <option key={e} value={e}>{t(e)}</option>)}
        </select>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className={s['measurements__table']}>
          <table>
            <thead>
              <tr>
                <SortHeader field="client_name" label="Cliente" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
                <SortHeader field="client_phone" label="Teléfono" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
                <SortHeader field="client_address" label="Dirección" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
                <SortHeader field="scheduled_date" label="Fecha" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
                <SortHeader field="scheduled_time" label="Hora" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
                <SortHeader field="status" label="Estado" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
                <th style={{ width: 100 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((m: Measurement) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{m.client_name}</td>
                  <td>{m.client_phone || '-'}</td>
                  <td>{m.client_address || '-'}</td>
                  <td>{formatDate(m.scheduled_date)}</td>
                  <td>{m.scheduled_time || '-'}</td>
                  <td><StatusBadge status={m.status || ''} /></td>
                  <td>
                    <div className={s['measurements__cell-actions']}>
                      <button className="btn btn-outline" onClick={() => navigate(`/admin/measurements/${m.id}`)}>
                        <Eye size={14} />
                      </button>
                      <button className="btn btn-danger" onClick={() => setDeleteId(m.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      message={
                        dateFilterEnabled
                          ? `No hay mediciones programadas para el ${formatDate(dateFilter)}.`
                          : 'No hay mediciones registradas.'
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog open={!!deleteId} onCancel={() => setDeleteId(null)} onConfirm={handleDelete} title="Eliminar medición" message="¿Estás seguro?" confirmLabel="Eliminar" danger />
    </div>
  );
}