import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Trash2, ChevronRight, ChevronLeft, FileDown } from 'lucide-react';
import { getWorkOrders, deleteWorkOrder, updateWorkOrder, getWorkOrderPdf, getWorkOrderPdfBlob, mapWorkOrderStatusToApi } from '@/api/resources/workOrders';
import { usePaginatedList, useDelete } from '../../api/hooks';
import { formatDate, orderStatuses } from '../../utils/formatters';
import CurrencyDisplay from '../../components/ui/CurrencyDisplay';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput';
import { EmptyState } from '../../components/ui/EmptyState';
import { Pagination } from '../../components/ui/Pagination';
import PdfPreviewModal from '../../components/common/PdfPreviewModal';
import { useNotify } from '../../context/NotificationContext';
import styles from './WorkOrdersListPage.module.css';

const s = styles as unknown as Record<string, string>;

const WORK_ORDERS_KEY = ['work-orders'] as const;

export default function WorkOrdersList() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState<string>(searchParams.get('search') || '');
  const [estado, setEstado] = useState<string>(searchParams.get('status') || '');
  const [deleteId, setDeleteId] = useState<number | string | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [pdfPreviewTitle, setPdfPreviewTitle] = useState<string>('Vista previa PDF');

  const notify = useNotify();

  useEffect(() => {
    setSearch(searchParams.get('search') || '');
    setEstado(searchParams.get('status') || '');
  }, [searchParams]);

  const { items: data, loading, total, page, pageSize, setPage, refetch } = usePaginatedList<Record<string, unknown>>(
    [...WORK_ORDERS_KEY, search, estado],
    async ({ skip, limit }) => {
      return getWorkOrders({ search: search || undefined, status: estado || undefined, skip, limit });
    },
    { pageSize: 25 },
  );

  const deleteMutation = useDelete<unknown, number | string>(
    WORK_ORDERS_KEY,
    async (id) => { await deleteWorkOrder(id); },
    { invalidateKeys: [WORK_ORDERS_KEY] }
  );

  const handleDelete = async () => {
    if (deleteId === null) return;
    await deleteMutation.mutateAsync(deleteId);
    setDeleteId(null);
  };

  const avanzarEstado = async (o: Record<string, unknown>) => {
    const idx = orderStatuses.indexOf(o.status as string);
    if (idx < orderStatuses.length - 1) {
      await updateWorkOrder(o.id as string, mapWorkOrderStatusToApi(orderStatuses[idx + 1]));
      refetch();
    }
  };

  const retrocederEstado = async (o: Record<string, unknown>) => {
    const idx = orderStatuses.indexOf(o.status as string);
    if (idx > 0) {
      await updateWorkOrder(o.id as string, mapWorkOrderStatusToApi(orderStatuses[idx - 1]));
      refetch();
    }
  };

  const handleOpenPdf = async (o: Record<string, unknown>) => {
    setPdfPreviewLoading(true);
    setPdfPreviewTitle(`Vista previa — ${(o.number as string) || 'Orden de Trabajo'}`);
    setPdfPreviewUrl(null);
    try {
      const url = await getWorkOrderPdfBlob(o.id as number);
      setPdfPreviewUrl(url);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        || (err as Error).message
        || 'Error al generar PDF';
      notify(detail, 'error');
    } finally {
      setPdfPreviewLoading(false);
    }
  };

  const handleClosePdfPreview = () => {
    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    setPdfPreviewUrl(null);
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
          <option value="MEASUREMENT">En Medicion</option>
          <option value="WORKSHOP">En Taller</option>
          <option value="FINISHED">Terminadas (En Local)</option>
          <option value="DELIVERED">Entregadas</option>
          <option value="CANCELLED">Canceladas</option>
        </select>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Total</th>
                  <th>Seña</th>
                  <th>Saldo</th>
                  <th>Fecha Entrega</th>
                  <th style={{ width: 110 } as React.CSSProperties}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map((o: Record<string, unknown>) => (
                  <tr key={o.id as number} style={{ cursor: 'pointer' } as React.CSSProperties} onClick={() => navigate(`/admin/work-orders/${o.id as number}`)}>
                    <td style={{ fontWeight: 600, fontFamily: 'monospace' } as React.CSSProperties}>{(o as Record<string, unknown>).number as string}</td>
                    <td>{(o as Record<string, unknown>).client_name as string || '-'}</td>
                    <td><StatusBadge status={(o as Record<string, unknown>).status as string} /></td>
                    <td style={{ fontWeight: 600 } as React.CSSProperties}><CurrencyDisplay value={(o as Record<string, unknown>).total as number} style={{ fontWeight: 600 }} /></td>
                    <td><CurrencyDisplay value={(o as Record<string, unknown>).deposit_received as number} /></td>
                    <td style={{ fontWeight: 600 } as React.CSSProperties}><CurrencyDisplay value={(o as Record<string, unknown>).balance_due as number} style={{ fontWeight: 600 }} /></td>
                    <td>{formatDate((o as Record<string, unknown>).delivery_date as string)}</td>
                    <td onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4 } as React.CSSProperties}>
                        {(o as Record<string, unknown>).status as string !== orderStatuses[0] && (
                          <button className="btn btn-outline" style={{ padding: '4px 6px' } as React.CSSProperties} onClick={() => retrocederEstado(o)} title="Retroceder estado">
                            <ChevronLeft size={14} />
                          </button>
                        )}
                        {(o as Record<string, unknown>).status as string !== orderStatuses[orderStatuses.length - 1] && (
                          <button className="btn btn-outline" style={{ padding: '4px 6px' } as React.CSSProperties} onClick={() => avanzarEstado(o)} title="Avanzar estado">
                            <ChevronRight size={14} />
                          </button>
                        )}
                        <button className="btn btn-outline" style={{ padding: '4px 6px' } as React.CSSProperties}                         onClick={() => handleOpenPdf(o)} title="Ver PDF">
                          <FileDown size={14} />
                        </button>
                        <button className="btn btn-danger" style={{ padding: '4px 6px' } as React.CSSProperties} onClick={() => setDeleteId((o as Record<string, unknown>).id as number)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr><td colSpan={8}><EmptyState message="No hay órdenes de trabajo" /></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog open={!!deleteId} onCancel={() => setDeleteId(null)} onConfirm={handleDelete} title="Eliminar orden" message="¿Estás seguro?" confirmLabel="Eliminar" danger />

      <PdfPreviewModal
        isOpen={!!pdfPreviewUrl || pdfPreviewLoading}
        onClose={handleClosePdfPreview}
        pdfUrl={pdfPreviewUrl}
        loading={pdfPreviewLoading}
        title={pdfPreviewTitle}
      />

      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} label="ordenes" />
    </div>
  );
}
