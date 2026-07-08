import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Trash2, ChevronRight, ChevronLeft, FileDown, Eye, Send, Mail } from 'lucide-react';
import { getWorkOrders, getWorkOrder, deleteWorkOrder, updateWorkOrder, mapWorkOrderStatusToApi } from '@/api/resources/workOrders';
import { usePaginatedList, useDelete } from '../../api/hooks';
import { formatDate, orderStatuses } from '../../utils/formatters';
import { useSettingsWithTerms } from '../../hooks/useSettingsWithTerms';
import { buildPdfData } from '../../utils/pdf/buildPdfData';
import type { PdfDocumentData } from '../../utils/pdf/buildPdfData';
import { mapApiToForm } from '../../hooks/entityFormHelpers';
import CurrencyDisplay from '../../components/ui/CurrencyDisplay';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import { PageHeader } from '../../components/ui/PageHeader/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput/SearchInput';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { Pagination } from '../../components/ui/Pagination';
import PdfPreviewModal from '../../components/ui/PdfPreviewModal/PdfPreviewModal';
import SketchImageExtractor from '../../components/ui/PdfPreviewModal/SketchImageExtractor';
import { useNotify } from '../../context/NotificationContext';
import type { WorkOrderListItem } from '../../types/workOrder';
import styles from './WorkOrdersListPage.module.css';

const s = styles as unknown as Record<string, string>;

const WORK_ORDERS_KEY = ['work-orders'] as const;

const btnCls = (variant?: 'success' | 'info' | 'danger') => {
  const base = s['workOrders__action-btn'];
  if (variant === 'success') return `${base} ${s['workOrders__action-btn--success']}`;
  if (variant === 'info') return `${base} ${s['workOrders__action-btn--info']}`;
  if (variant === 'danger') return `${base} ${s['workOrders__action-btn--danger']}`;
  return base;
};

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
      // Run the raw API response through the same mapper the edit form uses
      // (`mapApiToForm`). That gives us a fully-typed `EntityFormState` with
      // dates sliced, JSON-encoded *_data fields parsed, and — most
      // importantly for this fix — `sketch_elements` decoded from its
      // JSON string into the page-list the SketchImageExtractor expects.
      // Without this step, the extractor receives the raw TEXT-column
      // string and silently produces zero pages (no croquis in the PDF).
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
        <div className={s['workOrders__table']}>
          <table>
            <thead>
              <tr>
                <th className={s['workOrders__th']} style={{ width: 100 }}>Número</th>
                <th className={s['workOrders__th']} style={{ width: 95 }}>Fecha</th>
                <th className={s['workOrders__th']}>Cliente</th>
                <th className={s['workOrders__th']} style={{ width: 120 }}>Teléfono</th>
                <th className={s['workOrders__th']}>Material</th>
                <th className={s['workOrders__th']} style={{ width: 110 }}>Total</th>
                <th className={s['workOrders__th']} style={{ width: 100 }}>Seña</th>
                <th className={s['workOrders__th']} style={{ width: 110 }}>Saldo</th>
                <th className={s['workOrders__th']} style={{ width: 110 }}>Entrega</th>
                <th className={s['workOrders__th']} style={{ width: 110 }}>Estado</th>
                <th className={s['workOrders__th']} style={{ width: 90 }}>Avanzar</th>
                <th className={s['workOrders__th']} style={{ width: 140 }}>Vista</th>
                <th className={s['workOrders__th']} style={{ width: 150 }}>Notificar</th>
                <th className={s['workOrders__th']} style={{ width: 70 }}>Eliminar</th>
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
                    className={s['workOrders__row']}
                    onClick={() => handleView(o)}
                  >
                    <td className={s['workOrders__td']}>
                      <span className={s['workOrders__numero']}>{o.number}</span>
                    </td>
                    <td className={s['workOrders__td']}>
                      {formatDate((o.date || o.created_at || '').split('T')[0]) || '-'}
                    </td>
                    <td className={s['workOrders__td']}>{o.client_name || '-'}</td>
                    <td className={s['workOrders__td']}>{o.client_phone || '-'}</td>
                    <td className={s['workOrders__td'] + ' ' + s['workOrders__material']}>
                      {o.material || '-'}
                    </td>
                    <td className={s['workOrders__td'] + ' ' + s['workOrders__total-cell']}>
                      <CurrencyDisplay value={o.total} />
                    </td>
                    <td className={s['workOrders__td']}>
                      <CurrencyDisplay value={o.deposit_received} />
                    </td>
                    <td className={s['workOrders__td'] + ' ' + s['workOrders__total-cell']}>
                      <CurrencyDisplay value={o.balance_due} />
                    </td>
                    <td className={s['workOrders__td']}>
                      {formatDate(o.delivery_date || '') || '-'}
                    </td>
                    <td className={s['workOrders__td']}>
                      <StatusBadge status={o.status} />
                    </td>

                    {/* Column 11 — Avanzar / Retroceder estado */}
                    <td
                      className={`${s['workOrders__td']} ${s['workOrders__actions-cell']}`}
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                      <div className={s['workOrders__action-pair']}>
                        {canBack && (
                          <button
                            type="button"
                            className={btnCls()}
                            onClick={() => handleStatusAdvance(o, -1)}
                            title="Retroceder estado"
                          >
                            <ChevronLeft size={12} />
                          </button>
                        )}
                        {canForward && (
                          <button
                            type="button"
                            className={btnCls('info')}
                            onClick={() => handleStatusAdvance(o, 1)}
                            title="Avanzar estado"
                          >
                            <ChevronRight size={12} />
                          </button>
                        )}
                        {!canBack && !canForward && (
                          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
                        )}
                      </div>
                    </td>

                    {/* Column 12 — Vista: Ver + PDF */}
                    <td
                      className={`${s['workOrders__td']} ${s['workOrders__actions-cell']}`}
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                      <div className={s['workOrders__action-pair']}>
                        <button
                          type="button"
                          className={btnCls()}
                          onClick={() => handleView(o)}
                          title="Ver / editar"
                        >
                          <Eye size={12} /> Ver
                        </button>
                        <button
                          type="button"
                          className={btnCls()}
                          onClick={() => handleOpenPdf(o)}
                          title="Vista previa del PDF"
                        >
                          <FileDown size={12} /> PDF
                        </button>
                      </div>
                    </td>

                    {/* Column 13 — Notificar */}
                    <td
                      className={`${s['workOrders__td']} ${s['workOrders__actions-cell']}`}
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                      <div className={s['workOrders__action-pair']}>
                        <button
                          type="button"
                          className={canWhatsApp ? btnCls('success') : btnCls()}
                          onClick={canWhatsApp ? () => handleEnviarWhatsApp(o) : undefined}
                          disabled={!canWhatsApp}
                          style={canWhatsApp ? undefined : { opacity: 0.4, cursor: 'not-allowed' }}
                          title={canWhatsApp ? `Enviar WhatsApp a ${o.client_phone}` : 'Sin teléfono cargado'}
                        >
                          <Send size={12} /> WhatsApp
                        </button>
                        <button
                          type="button"
                          className={btnCls('info')}
                          onClick={() => {
                            // TODO: hook send-work-order-email endpoint when available.
                            notify('Correo de OT todavía no implementado', 'info');
                          }}
                          title="Enviar PDF por correo"
                          disabled
                          style={{ opacity: 0.4, cursor: 'not-allowed' }}
                        >
                          <Mail size={12} />Correo</button>
                      </div>
                    </td>

                    {/* Column 14 — Eliminar */}
                    <td
                      className={`${s['workOrders__td']} ${s['workOrders__actions-cell']}`}
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className={btnCls('danger')}
                        onClick={() => setDeleteId(o.id)}
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

      <PdfPreviewModal
        isOpen={pdfData !== null || pdfPreviewLoading}
        onClose={handleClosePdfPreview}
        data={pdfData}
        loading={pdfPreviewLoading}
        title={pdfPreviewTitle}
        fileName={`orden_${pendingFormData?.number || ''}.pdf`}
      />

      {sketchExtractorActive && pendingFormData && (
        <SketchImageExtractor
          sketchElements={pendingFormData.sketch_elements}
          onReady={handleSketchImagesReady}
        />
      )}

      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} label="ordenes" />
    </div>
  );
}