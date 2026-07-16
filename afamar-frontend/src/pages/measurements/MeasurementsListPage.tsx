import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, CalendarDays } from 'lucide-react';
import { getMeasurements, deleteMeasurement } from '@/api/resources/measurements';
import { getWorkOrders } from '@/api/resources/workOrders';
import { useList, useDelete, useGet } from '../../api/hooks';
import { measurementStatuses, todayLocalISO } from '../../utils/formatters';
import { t } from '../../utils/translate';
import type { Measurement } from '../../types/measurement';
import type { WorkOrderListItem } from '../../types/workOrder';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import { PageHeader } from '../../components/ui/PageHeader/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput/SearchInput';
import PendingMeasurementCards from '../../components/measurements/PendingMeasurementCards/PendingMeasurementCards';
import { MeasurementsTable } from '../../components/measurements/MeasurementsTable/MeasurementsTable';
import styles from './MeasurementsListPage.module.css';

const s = styles as unknown as Record<string, string>;

const MEASUREMENTS_KEY = ['measurements'] as const;

type SortField = 'client_name' | 'client_phone' | 'client_address' | 'scheduled_date' | 'scheduled_time' | 'status';
type SortDir = 'asc' | 'desc';

export default function MeasurementsList() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState<string>(todayLocalISO());
  const [dateFilterEnabled, setDateFilterEnabled] = useState<boolean>(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);
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

  const { data: pendingOrders, loading: pendingLoading } = useGet<WorkOrderListItem[]>(
    ['work-orders', 'pending-measurement'],
    async () => {
      const res = await getWorkOrders({ status: 'MEASUREMENT', limit: 100 });
      return (res.data as WorkOrderListItem[]) || [];
    }
  );

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
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

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
        <MeasurementsTable
          visibleRows={visibleRows}
          sortField={sortField}
          sortDir={sortDir}
          dateFilter={dateFilter}
          dateFilterEnabled={dateFilterEnabled}
          onSort={handleSort}
          onView={(id) => navigate(`/admin/measurements/${id}`)}
          onDelete={(id) => setDeleteId(id)}
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar medición"
        message="¿Estás seguro?"
        confirmLabel="Eliminar"
        danger
      />
    </div>
  );
}
