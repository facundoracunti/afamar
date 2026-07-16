import React, { Suspense, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { getWorkOrders, getWorkOrder, deleteWorkOrder, updateWorkOrder, mapWorkOrderStatusToApi } from '@/api/resources/workOrders';
import { usePaginatedList, useDelete } from '../../api/hooks';
import { orderStatuses } from '../../utils/formatters';
import { useSettingsWithTerms } from '../../hooks/useSettingsWithTerms';
import { buildPdfData } from '../../utils/pdf/buildPdfData';
import type { PdfDocumentData } from '../../utils/pdf/buildPdfData';
import { mapApiToForm } from '../../hooks/entityFormHelpers';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import { PageHeader } from '../../components/ui/PageHeader/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput/SearchInput';
import { Pagination } from '../../components/ui/Pagination';
const PdfPreviewModal = React.lazy(() => import('../../components/ui/PdfPreviewModal/PdfPreviewModal'));
const SketchImageExtractor = React.lazy(() => import('../../components/ui/PdfPreviewModal/SketchImageExtractor'));
import { WorkOrdersTable } from '../../components/common/WorkOrdersTable';
import { useNotify } from '../../context/NotificationContext';
import type { WorkOrderListItem } from '../../types/workOrder';
import styles from './WorkOrdersListPage.module.css';

const s = styles as unknown as Record<string, string>;

const WORK_ORDERS_KEY = ['work-orders'] as const;

export default function WorkOrdersList() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState<string>(searchParams.get('search') || '');
  const [estado, setEstado] = useState<string>(searchParams.get('status') || '');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [pdfData, setPdfData] = useState<PdfDocumentData | null>(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [pdfPreviewTitle, setPdfPreviewTitle] = useState<string>('Vista previa PDF');
  const [sketchExtractorActive, setSketchExtractorActive] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<Record<string, unknown> | null>(null);

  const notify = useNotify();
  const { company, globalTerms } = useSettingsWithTerms();

  useEffect(() => {
    setSearch(searchParams.get('search') || '');
    setEstado(searchParams.get('status') || '');
  }, [searchParams]);

  const { items: data, loading, total, page, pageSize, setPage, refetch } = usePaginatedList<WorkOrderListItem>(
    [...WORK_ORDERS_KEY, search, estado],
    async ({ skip, limit }) => {
      return getWorkOrders({ search: search || undefined, status: estado || undefined, skip, limit });
    },
    { pageSize: 25 },
  );

  const deleteMutation = useDelete<unknown, number>(
    WORK_ORDERS_KEY,
    async (id) => { await deleteWorkOrder(id); },
    { invalidateKeys: [WORK_ORDERS_KEY] }
  );

  const handleDelete = async (): Promise<void> => {
    if (deleteId === null) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      notify('Orden eliminada correctamente', 'success');
      setDeleteId(null);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        || (err as Error).message
        || 'Error al eliminar';
      notify(detail, 'error');
    }
  };

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
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        || (err as Error).message
        || 'Error al cambiar estado';
      notify(detail, 'error');
    }
  };

  const handleOpenPdf = async (o: WorkOrderListItem): Promise<void> => {
    setPdfPreviewLoading(true);
    setPdfPreviewTitle(`Vista previa — ${o.number || 'Orden de Trabajo'}`);
    setPdfData(null);
    try {
      const res = await getWorkOrder(o.id);
      const apiRow = (res as unknown as { data: Record<string, unknown> }).data;
      const formData = mapApiToForm(apiRow, o.status || 'MEASUREMENT');
      setPendingFormData(formData as unknown as Record<string, unknown>);
      setSketchExtractorActive(true);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || (err as Error).message
        || 'Error al cargar la orden';
      notify(detail, 'error');
      setPdfPreviewLoading(false);
    }
  };

  const handleSketchImagesReady = (images: string[]): void => {
    if (!pendingFormData) { setPdfPreviewLoading(false); return; }
    const data = buildPdfData({
      form: pendingFormData,
      document_type: 'work_order',
      company,
      globalTerms,
      sketchImages: images,
    });
    setPdfData(data);
    setPdfPreviewLoading(false);
    setSketchExtractorActive(false);
  };

  const handleClosePdfPreview = (): void => {
    setPdfData(null);
    setSketchExtractorActive(false);
    setPendingFormData(null);
  };

  const handleEnviarWhatsApp = (o: WorkOrderListItem): void => {
    const phone = (o.client_phone || '').replace(/[^\d]/g, '');
    const nombre = o.client_name || '';
    const saludo = nombre ? `Hola ${nombre}! ` : '';
    const mensaje = `${saludo}Te compartimos la información de tu Orden de Trabajo AFAMAR.`;
    const whatsappUrl = phone
      ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(mensaje)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
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
          onDelete={(id) => setDeleteId(id)}
        />
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar orden"
        message="Estas seguro?"
        confirmLabel="Eliminar"
        danger
      />

      <Suspense fallback={<LoadingSpinner />}>
        <PdfPreviewModal
          isOpen={pdfData !== null || pdfPreviewLoading}
          onClose={handleClosePdfPreview}
          data={pdfData}
          loading={pdfPreviewLoading}
          title={pdfPreviewTitle}
          fileName={`orden_${pendingFormData?.number || ''}.pdf`}
        />
      </Suspense>

      {sketchExtractorActive && pendingFormData && (
        <Suspense fallback={null}>
          <SketchImageExtractor
            sketchElements={pendingFormData.sketch_elements}
            onReady={handleSketchImagesReady}
          />
        </Suspense>
      )}

      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} label="ordenes" />
    </div>
  );
}
