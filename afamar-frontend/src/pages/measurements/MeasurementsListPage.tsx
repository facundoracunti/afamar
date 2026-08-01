import React, { Suspense, useEffect, useMemo, useState } from 'react';
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
import { Modal } from '../../components/ui/Modal/Modal';
import { PageHeader } from '../../components/ui/PageHeader/PageHeader';
import { Pagination } from '../../components/ui/Pagination';
import { SearchInput } from '../../components/ui/SearchInput/SearchInput';
import PendingMeasurementCards, { type PendingMeasurementSort } from '../../components/measurements/PendingMeasurementCards/PendingMeasurementCards';
import { MeasurementsTable } from '../../components/measurements/MeasurementsTable/MeasurementsTable';
import styles from './MeasurementsListPage.module.css';

const MeasurementForm = React.lazy(() => import('./MeasurementFormPage'));

type MeasurementModal = null
  | { kind: 'create' }
  | { kind: 'createFromWo'; workOrderId: number }
  | { kind: 'edit'; id: number };

const s = styles as unknown as Record<string, string>;

const MEASUREMENTS_KEY = ['measurements'] as const;
const PAGE_SIZE = 25;
const PENDING_PAGE_SIZE = 15;

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
  const [page, setPage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingSort, setPendingSort] = useState<PendingMeasurementSort>('delivery_asc');
  const [modal, setModal] = useState<MeasurementModal>(null);
  const closeMeasurementModal = () => setModal(null);
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
      const res = await getWorkOrders({ status: 'MEASUREMENT', limit: 1000 });
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

  const sortedPendingOrders = useMemo(() => {
    const sorted = [...unscheduledOrders];
    sorted.sort((a, b) => {
      if (pendingSort === 'client_asc') {
        return (a.client_name || '').localeCompare(b.client_name || '', 'es', { sensitivity: 'base' });
      }
      if (pendingSort === 'number_asc') {
        return a.number.localeCompare(b.number, 'es', { numeric: true });
      }
      if (pendingSort === 'created_asc' || pendingSort === 'created_desc') {
        const comparison = (a.created_at || '').localeCompare(b.created_at || '');
        return pendingSort === 'created_asc' ? comparison : -comparison;
      }
      const dateA = a.delivery_date || '';
      const dateB = b.delivery_date || '';
      if (!dateA && dateB) return 1;
      if (dateA && !dateB) return -1;
      return dateA.localeCompare(dateB);
    });
    return sorted;
  }, [unscheduledOrders, pendingSort]);

  const pendingTotalPages = Math.max(1, Math.ceil(sortedPendingOrders.length / PENDING_PAGE_SIZE));
  const safePendingPage = Math.min(pendingPage, pendingTotalPages);
  const visiblePendingOrders = sortedPendingOrders.slice(
    (safePendingPage - 1) * PENDING_PAGE_SIZE,
    safePendingPage * PENDING_PAGE_SIZE,
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

  useEffect(() => { setPage(1); }, [search, statusFilter, dateFilter, dateFilterEnabled]);
  useEffect(() => { setPendingPage(1); }, [pendingSort]);
  useEffect(() => {
    if (pendingPage > pendingTotalPages) setPendingPage(pendingTotalPages);
  }, [pendingPage, pendingTotalPages]);

  const visibleRowsAll = useMemo(() => {
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
  const totalPages = Math.max(1, Math.ceil(visibleRowsAll.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleRows = visibleRowsAll.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  return (
    <div className={s['measurements']}>
      <PageHeader
        title="Agenda de Medición"
        actions={
          <button className="btn btn-primary" onClick={() => setModal({ kind: 'create' })}>
            <Plus size={16} /> Nueva Medición
          </button>
        }
      />

      <PendingMeasurementCards
        orders={visiblePendingOrders}
        loading={pendingLoading}
        total={sortedPendingOrders.length}
        page={safePendingPage}
        pageSize={PENDING_PAGE_SIZE}
        sort={pendingSort}
        onPageChange={setPendingPage}
        onSortChange={setPendingSort}
        onCreateFromWo={(workOrderId) => setModal({ kind: 'createFromWo', workOrderId })}
      />

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
        <>
          <MeasurementsTable
            visibleRows={visibleRows}
            sortField={sortField}
            sortDir={sortDir}
            dateFilter={dateFilter}
            dateFilterEnabled={dateFilterEnabled}
            onSort={handleSort}
            onView={(id) => setModal({ kind: 'edit', id })}
            onDelete={(id) => setDeleteId(id)}
          />
          <Pagination page={safePage} pageSize={PAGE_SIZE} total={visibleRowsAll.length} onPageChange={setPage} label="mediciones" />
        </>
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

      <Suspense fallback={<LoadingSpinner />}>
        {modal && (
          <Modal
            isOpen
            onClose={closeMeasurementModal}
            title={
              modal.kind === 'edit'
                ? 'Editar Medición'
                : modal.kind === 'createFromWo'
                  ? 'Nueva Medición (orden)'
                  : 'Nueva Medición'
            }
            width="1100px"
          >
            {modal.kind === 'create' && (
              <MeasurementForm
                key="measurement-create"
                onSuccess={closeMeasurementModal}
                onCancel={closeMeasurementModal}
              />
            )}
            {modal.kind === 'createFromWo' && (
              <MeasurementForm
                key={`measurement-create-wo-${modal.workOrderId}`}
                presetWorkOrderId={modal.workOrderId}
                onSuccess={closeMeasurementModal}
                onCancel={closeMeasurementModal}
              />
            )}
            {modal.kind === 'edit' && (
              <MeasurementForm
                key={`measurement-edit-${modal.id}`}
                entityId={modal.id}
                onSuccess={closeMeasurementModal}
                onCancel={closeMeasurementModal}
              />
            )}
          </Modal>
        )}
      </Suspense>
    </div>
  );
}
