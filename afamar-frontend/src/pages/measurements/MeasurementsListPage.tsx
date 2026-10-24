import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { getMeasurements, updateMeasurement, deleteMeasurement } from '@/api/resources/measurements';
import { getWorkOrders } from '@/api/resources/workOrders';
import { useList, useUpdate, useDelete, useGet } from '../../api/hooks';
import { todayLocalISO } from '../../utils/formatters';
import type { Measurement } from '../../types/measurement';
import type { WorkOrderListItem } from '../../types/workOrder';
import { computeScheduledWorkOrderIds, countMeasurementStatuses } from '../../utils/measurementHelpers';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import { PageHeader } from '../../components/ui/PageHeader/PageHeader';
import { Pagination } from '../../components/ui/Pagination';
import PendingMeasurementCards, { type PendingMeasurementSort } from '../../components/measurements/PendingMeasurementCards/PendingMeasurementCards';
import { MeasurementsTable } from '../../components/measurements/MeasurementsTable/MeasurementsTable';
import { MeasurementsFiltersBar, type StatusTab } from './MeasurementsFiltersBar';
import { MeasurementFormModal, type MeasurementModal } from './MeasurementFormModal';
import {
  sortMeasurementRows,
  sortPendingOrders,
  type SortDir,
  type SortField,
} from './measurementListHelpers';
import styles from './MeasurementsListPage.module.css';

const s = styles as unknown as Record<string, string>;

const MEASUREMENTS_KEY = ['measurements'] as const;
const PAGE_SIZE = 25;
const PENDING_PAGE_SIZE = 15;

export default function MeasurementsList() {
  const [search, setSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState<StatusTab>('');
  const [dateFilter, setDateFilter] = useState<string>(todayLocalISO());
  const [dateFilterEnabled, setDateFilterEnabled] = useState<boolean>(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [sortField, setSortField] = useState<SortField>('scheduled_date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingSort, setPendingSort] = useState<PendingMeasurementSort>('delivery_asc');
  const [modal, setModal] = useState<MeasurementModal | null>(null);
  const closeMeasurementModal = () => setModal(null);

  const { items: data, loading } = useList<Measurement>(
    [...MEASUREMENTS_KEY, search, activeStatus, dateFilter, dateFilterEnabled],
    async () => {
      const res = await getMeasurements({
        search: search || undefined,
        status: activeStatus || undefined,
        scheduled_date: dateFilterEnabled ? dateFilter : undefined,
      });
      return (res.data as Measurement[]) || [];
    }
  );

  // All measurements WITHOUT the agenda date filter. Drives both the pending
  // cards (a work order hides as soon as it has a non-cancelled visit, even
  // when that visit is scheduled for another day) and the tab counters.
  const { data: allMeasurements } = useGet<Measurement[]>(
    [...MEASUREMENTS_KEY, 'agenda-ids'],
    async () => {
      const res = await getMeasurements({ limit: 1000 });
      return (res.data as Measurement[]) || [];
    }
  );

  const deleteMutation = useDelete<unknown, number>(
    MEASUREMENTS_KEY,
    async (id) => { await deleteMeasurement(id); },
    { invalidateKeys: [MEASUREMENTS_KEY] }
  );

  const doneMutation = useUpdate<unknown, number>(
    MEASUREMENTS_KEY,
    async (id) => { await updateMeasurement(id, { status: 'DONE' }); },
    { invalidateKeys: [MEASUREMENTS_KEY] }
  );

  const { data: pendingOrders, loading: pendingLoading } = useGet<WorkOrderListItem[]>(
    ['work-orders', 'pending-measurement'],
    async () => {
      const res = await getWorkOrders({ status: 'MEASUREMENT', limit: 1000 });
      return (res.data as WorkOrderListItem[]) || [];
    }
  );

  const scheduledWorkOrderIds = useMemo(
    () => computeScheduledWorkOrderIds(allMeasurements || []),
    [allMeasurements],
  );

  const statusCounts = useMemo(
    () => countMeasurementStatuses(allMeasurements || []),
    [allMeasurements],
  );

  const unscheduledOrders = useMemo(
    () => (pendingOrders || []).filter((wo) => !scheduledWorkOrderIds.has(wo.id)),
    [pendingOrders, scheduledWorkOrderIds],
  );

  const sortedPendingOrders = useMemo(
    () => sortPendingOrders(unscheduledOrders, pendingSort),
    [unscheduledOrders, pendingSort],
  );

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

  const handleDone = async (id: number): Promise<void> => {
    await doneMutation.mutateAsync(id);
  };

  const handleSort = (field: SortField): void => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleDateFilterChange = (value: string): void => {
    setDateFilter(value);
    setDateFilterEnabled(true);
  };

  useEffect(() => { setPage(1); }, [search, activeStatus, dateFilter, dateFilterEnabled]);
  useEffect(() => { setPendingPage(1); }, [pendingSort]);
  useEffect(() => {
    if (pendingPage > pendingTotalPages) setPendingPage(pendingTotalPages);
  }, [pendingPage, pendingTotalPages]);

  const visibleRowsAll = useMemo(
    () => sortMeasurementRows(data, sortField, sortDir),
    [data, sortField, sortDir],
  );
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

      <MeasurementsFiltersBar
        search={search}
        onSearchChange={setSearch}
        activeStatus={activeStatus}
        onStatusChange={setActiveStatus}
        statusCounts={statusCounts}
        dateFilter={dateFilter}
        onDateFilterChange={handleDateFilterChange}
        dateFilterEnabled={dateFilterEnabled}
        onDateFilterToggle={() => setDateFilterEnabled((v) => !v)}
      />

      {loading ? <LoadingSpinner /> : (
        <>
          <MeasurementsTable
            visibleRows={visibleRows}
            sortField={sortField}
            sortDir={sortDir}
            dateFilter={dateFilter}
            dateFilterEnabled={dateFilterEnabled}
            activeStatus={activeStatus}
            onSort={handleSort}
            onView={(id) => setModal({ kind: 'edit', id })}
            onDelete={(id) => setDeleteId(id)}
            onDone={handleDone}
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

      {modal && (
        <MeasurementFormModal modal={modal} onClose={closeMeasurementModal} />
      )}
    </div>
  );
}
