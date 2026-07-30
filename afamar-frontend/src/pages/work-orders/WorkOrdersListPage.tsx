import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { getWorkOrders, getWorkOrder, deleteWorkOrder, updateWorkOrder, mapWorkOrderStatusToApi } from '@/api/resources/workOrders';
import { parseApiError } from '../../utils/error';
import { buildDocumentShareMessage, buildWhatsAppUrl } from '../../utils/whatsapp';
import { orderStatuses } from '../../utils/formatters';
import { useSettingsWithTerms } from '../../hooks/useSettingsWithTerms';
import { usePdfPreviewController } from '../../hooks/usePdfPreviewController';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import { PageHeader } from '../../components/ui/PageHeader/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput/SearchInput';
import { Pagination } from '../../components/ui/Pagination';
import { WorkOrdersTable } from '../../components/common/WorkOrdersTable';
import { useNotify } from '../../context/NotificationContext';
import { useEntityList } from '../../hooks/useEntityList';
import type { WorkOrderListItem } from '../../types/workOrder';
import styles from './WorkOrdersListPage.module.css';

const s = styles as unknown as Record<string, string>;

const WORK_ORDERS_KEY = ['work-orders'] as const;

export default function WorkOrdersList({ initialStatus }: { initialStatus?: string } = {}) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState<string>(searchParams.get('search') || '');
  const [estado, setEstado] = useState<string>(initialStatus ?? searchParams.get('status') ?? '');

  const notify = useNotify();
  const { company, globalTerms } = useSettingsWithTerms();

  const pdf = usePdfPreviewController({
    documentType: 'work_order',
    fetchEntity: async (id) => getWorkOrder(id as number) as unknown as { data: Record<string, unknown> },
    defaultStatus: 'MEASUREMENT',
    label: 'Orden de Trabajo',
    fileNamePrefix: 'orden_',
    company,
    globalTerms,
    notify,
  });

  useEffect(() => {
    setSearch(searchParams.get('search') || '');
    setEstado(searchParams.get('status') || '');
  }, [searchParams]);

  const {
    items: data,
    loading,
    total,
    page,
    pageSize,
    setPage,
    refetch,
    deleteId,
    requestDelete,
    cancelDelete,
    confirmDelete,
  } = useEntityList<WorkOrderListItem, number>({
    // The page-level `search` + `estado` filters participate in the query
    // key so changing them triggers a refetch. The hook owns `search` so
    // we wire it through our listFetcher, but we still pass `estado`
    // here to include it in the key.
    queryKey: [...WORK_ORDERS_KEY, search, estado],
    listFetcher: async ({ skip, limit }) =>
      getWorkOrders({ search: search || undefined, status: estado || undefined, skip, limit }),
    deleteFn: (id) => deleteWorkOrder(id),
    pageSize: 25,
    successMessage: 'Orden eliminada correctamente',
    errorMessage: 'Error al eliminar',
  });

  const handleStatusAdvance = async (o: WorkOrderListItem, direction: 1 | -1): Promise<void> => {
    const idx = orderStatuses.indexOf(o.status);
    if (idx < 0) return;
    const next = orderStatuses[idx + direction];
    if (!next) return;
    try {
      await updateWorkOrder(o.id, mapWorkOrderStatusToApi(next));
      notify(`Estado actualizado a ${next}`, 'success');
      refetch();
    } catch (err: unknown) {
      notify(parseApiError(err, 'Error al cambiar estado'), 'error');
    }
  };

  const handleOpenPdf = (o: WorkOrderListItem) => pdf.handleOpenPdf(o);

  const handleEnviarWhatsApp = (o: WorkOrderListItem): void => {
    const mensaje = buildDocumentShareMessage({
      clientName: o.client_name,
      documentLabel: 'la información de tu Orden de Trabajo AFAMAR',
      pdfUrl: '', // WorkOrder list doesn't carry the PDF URL — keep raw greeting.
    });
    const whatsappUrl = buildWhatsAppUrl(o.client_phone, mensaje);
    window.open(whatsappUrl, '_blank');
  };

  const handleView = (o: WorkOrderListItem): void => {
    navigate(`/admin/work-orders/${o.id}`);
  };

  return (
    <div className={s['workOrders']}>
      <PageHeader
        title="Órdenes de Trabajo"
        actions={
          <button className="btn btn-primary" onClick={() => navigate('/admin/work-orders/new')}>
            <Plus size={16} /> Nueva Orden
          </button>
        }
      />

      <div className={s['workOrders__filters']}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por número o cliente..."
          leftIcon={<Search size={18} color="#94a3b8" />}
        />
        <select
          className="input"
          style={{ width: 260 }}
          value={estado}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEstado(e.target.value)}
        >
          <option value="">Todas</option>
          <option value="MEASUREMENT">En Medición</option>
          <option value="WORKSHOP">En Taller</option>
          <option value="FINISHED">Terminadas (En Local)</option>
          <option value="DELIVERED">Entregadas</option>
          <option value="CANCELLED">Canceladas</option>
        </select>
      </div>

      {loading ? <LoadingSpinner /> : (
        <WorkOrdersTable
          data={data}
          onView={handleView}
          onStatusAdvance={handleStatusAdvance}
          onOpenPdf={handleOpenPdf}
          onWhatsApp={handleEnviarWhatsApp}
          onDelete={requestDelete}
        />
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
        title="Eliminar orden"
        message="Estas seguro?"
        confirmLabel="Eliminar"
        danger
      />

      {pdf.UI}

      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} label="ordenes" />
    </div>
  );
}