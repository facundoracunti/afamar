import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Trash2, FileDown, FileOutput, Eye, Send, Mail } from 'lucide-react';
import {
  getBudgetsUnified,
  deleteBudget,
  updateBudget,
  convertBudgetToWorkOrder,
  getBudgetPdf,
  getBudgetPdfBlob,
  sendBudgetEmail,
  mapBudgetStatusToApi,
  mapUnifiedBudget,
} from '@/api/resources/budgets';
import { updateOnlineBudget } from '@/api/resources/onlineBudgets';
import {
  deleteOnlineBudget,
  convertOnlineBudgetToWorkOrder,
} from '@/api/resources/onlineBudgets';
import { usePaginatedList, useDelete } from '../../api/hooks';
import type { AxiosResponse } from 'axios';
import { formatDate } from '../../utils/formatters';
import { t as translateStatus } from '../../utils/translate';
import CurrencyDisplay from '../../components/ui/CurrencyDisplay';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { Pagination } from '../../components/ui/Pagination';
import PdfPreviewModal from '../../components/common/PdfPreviewModal';
import { useNotify } from '../../context/NotificationContext';
import type { UnifiedBudget } from '../../types/budget';
import styles from './BudgetsListPage.module.css';

const s = styles as unknown as Record<string, string>;

const BUDGETS_KEY = ['budgets', 'unified'] as const;

interface PendingConvert {
  id: string | number;
  tipo: 'online' | 'local';
}

export default function BudgetsList() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState(searchParams.get('status') || '');
  const [deleteId, setDeleteId] = useState<string | number | null>(null);
  const [deleteTipo, setDeleteTipo] = useState<string | null>(null);
  const [pendingConvert, setPendingConvert] = useState<PendingConvert | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [pdfPreviewTitle, setPdfPreviewTitle] = useState<string>('Vista previa PDF');

  useEffect(() => {
    setEstado(searchParams.get('status') || '');
  }, [searchParams]);

  const notify = useNotify();

  const { items: data, loading, total, page, pageSize, setPage, refetch } = usePaginatedList<UnifiedBudget>(
    [...BUDGETS_KEY, search, estado],
    async ({ skip, limit }) => {
      // '' = active default (backend hides CONVERTED_TO_OT), 'ALL' = explicit no filter
      const statusParam = estado === 'ALL' ? 'ALL' : (estado || undefined);
      const res = (await getBudgetsUnified({
        search: search || undefined,
        status: statusParam,
        skip,
        limit,
      })) as AxiosResponse<Record<string, unknown>[]>;
      // Map snake_case → UnifiedBudget (type guard handled in the mapper)
      const mapped = (res.data || []).map((r) => mapUnifiedBudget(r as unknown as Parameters<typeof mapUnifiedBudget>[0]));
      // Replace `data` so the hook sees the mapped items in `items`.
      return Object.assign(res, { data: mapped }) as AxiosResponse<UnifiedBudget[]>;
    },
    { pageSize: 25 },
  );

  const deleteMutation = useDelete<unknown, string | number>(
    BUDGETS_KEY,
    async (id) => {
      if (deleteTipo === 'online') await deleteOnlineBudget(id as string);
      else await deleteBudget(id as string);
    },
    { invalidateKeys: [BUDGETS_KEY] }
  );

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      notify('Presupuesto eliminado correctamente', 'success');
      setDeleteId(null);
      setDeleteTipo(null);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        || (err as Error).message
        || 'Error al eliminar';
      notify(detail, 'error');
    }
  };

  const handleCambiarEstado = async (budget: UnifiedBudget, nuevoEstado: string) => {
    try {
      const payload = mapBudgetStatusToApi(nuevoEstado);
      if (budget.type === 'online') {
        await updateOnlineBudget(budget.id, payload);
      } else {
        await updateBudget(String(budget.id), payload);
      }
      notify(`Estado actualizado a ${nuevoEstado}`, 'success');
      refetch();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        || (err as Error).message
        || 'Error al cambiar estado';
      notify(detail, 'error');
    }
  };

  const performConvert = async (pending: PendingConvert) => {
    try {
      if (pending.tipo === 'online') {
        const res = await convertOnlineBudgetToWorkOrder(pending.id as string);
        notify(`Orden ${(res.data as Record<string, unknown>).number as string} creada exitosamente`, 'success');
        navigate(`/admin/work-orders/${(res.data as Record<string, unknown>).id as string}`);
      } else {
        const res = await convertBudgetToWorkOrder(pending.id as string);
        notify(`Orden ${(res.data as Record<string, unknown>).number as string} creada exitosamente`, 'success');
        navigate(`/admin/work-orders/${(res.data as Record<string, unknown>).id as string}`);
      }
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        || (err as Error).message
        || 'Error al convertir';
      notify(detail, 'error');
    }
  };

  const handleConvertir = (id: string | number) => {
    setPendingConvert({ id, tipo: 'local' });
  };

  const handleConvertirOnline = (id: string | number) => {
    setPendingConvert({ id, tipo: 'online' });
  };

  const handleEnviarWhatsApp = (presupuesto: UnifiedBudget) => {
    const telefono = (presupuesto.clientPhone || '').replace(/[^\d]/g, '');
    const nombre = presupuesto.clientName || '';
    const pdfUrl = getBudgetPdf(presupuesto.id as unknown as string);
    const saludo = nombre ? `Hola ${nombre}! ` : '';
    const mensaje = `${saludo}Te enviamos el presupuesto formal de AFAMAR Marmoles & Granitos. Podes revisarlo e imprimirlo desde el siguiente link: ${pdfUrl}`;
    const whatsappUrl = telefono
      ? `https://api.whatsapp.com/send?phone=${telefono}&text=${encodeURIComponent(mensaje)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleEnviarEmail = async (id: string | number) => {
    try {
      await sendBudgetEmail(id as string);
      notify('Email enviado correctamente', 'success');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        || (err as Error).message
        || 'Error al enviar email';
      notify(detail, 'error');
    }
  };

  const handleOpenPdf = async (budget: UnifiedBudget) => {
    setPdfPreviewLoading(true);
    setPdfPreviewTitle(`Vista previa — ${budget.number || 'Presupuesto'}`);
    setPdfPreviewUrl(null);
    try {
      const url = await getBudgetPdfBlob(budget.id);
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
    <div className={s['budgets']}>
      <PageHeader
        title="PRESUPUESTOS"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/admin/budgets/new')}
          >
            <Plus size={16} /> Nuevo Presupuesto Local
          </button>
        }
      />

      <div className={s['budgets__filters']}>
        <div className={s['budgets__search']}>
          <Search size={18} color="#94a3b8" />
          <input
            className="input"
            placeholder="Buscar por Nro / Cliente / Telefono / Material..."
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input"
          style={{ width: 280 }}
          value={estado}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEstado(e.target.value)}
        >
          <option value="">Activos (excluye Convertidos a OT)</option>
          <option value="PENDING">Pendiente</option>
          <option value="ONLINE">Online</option>
          <option value="APPROVED">Aprobado</option>
          <option value="REJECTED">Rechazado</option>
          <option value="CONVERTED_TO_OT">Convertido a OT</option>
          <option value="ALL">Todos</option>
        </select>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className={s['budgets__table']}>
          <table>
            <thead>
              <tr>
                <th className={s['budgets__th']} style={{ width: 90 }}>
                  Numero
                </th>
                <th className={s['budgets__th']} style={{ width: 95, fontSize: 12 }}>
                  Fecha
                </th>
                <th className={s['budgets__th']} style={{ width: 160 }}>
                  Cliente
                </th>
                <th className={s['budgets__th']} style={{ width: 110 }}>
                  Telefono
                </th>
                <th className={s['budgets__th']} style={{ width: 130 }}>
                  Material
                </th>
                <th className={s['budgets__th']}>Detalles</th>
                <th className={s['budgets__th']} style={{ width: 110 }}>
                  Total
                </th>
                <th className={s['budgets__th']} style={{ width: 100 }}>
                  Estado
                </th>
                <th className={s['budgets__th']} style={{ width: 180 }}>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((p: UnifiedBudget) => (
                <tr
                  key={p.type + '-' + p.id}
                  className={s['budgets__row']}
                  onClick={() =>
                    navigate(p.type === 'online' ? `/admin/online-budgets/${p.id}` : `/admin/budgets/${p.id}`)
                  }
                >
                  <td className={s['budgets__td']}>
                    <div className={s['budgets__numero']}>{p.number}</div>
                    {p.workOrderNumber && (
                      <div className={s['budgets__numeroSub']}>{'-> '}{p.workOrderNumber}</div>
                    )}
                  </td>
                  <td className={s['budgets__td']}>
                    {formatDate((p.date || '').split('T')[0]) || '-'}
                  </td>
                  <td className={s['budgets__td']}>{p.clientName || '-'}</td>
                  <td className={s['budgets__td']}>{p.clientPhone || '-'}</td>
                  <td className={s['budgets__td'] + ' ' + s['budgets__material']}>
                    {(() => {
                      if (p.materials && p.materials.length > 0)
                        return [...new Set(p.materials.map((m: { name: string }) => m.name.trim()))].join(' - ');
                      if (p.type === 'online' && p.items?.length) {
                        const mats = p.items
                          .filter(
                            (i: { detail: string }) =>
                              i.detail &&
                              i.detail !== 'LONGITUD' &&
                              ![
                                'BASEBOARDS',
                                'CUTOUT_SINK',
                                'CUTOUT_DROPIN_SINK',
                                'BRACKETS',
                                'CUTOUT_COOKTOP',
                                'FINISHING',
                                'POOL_MOD',
                              ].includes(i.detail),
                          )
                          .map((i: { detail: string }) => i.detail.trim());
                        const zocMat = p.items
                          .filter((i: { material?: string }) => i.material)
                          .map((i: { material?: string }) => (i.material || '').trim());
                        const all = [...new Set([...mats, ...zocMat])];
                        return all.length ? all.join(' - ') : 'Online';
                      }
                      return p.material || '-';
                    })()}
                  </td>
                  <td
                    className={s['budgets__td'] + ' ' + s['budgets__details']}
                    title={p.designObservations || ''}
                  >
                    {(() => {
                      const txt = p.designObservations || '';
                      return txt.length > 60 ? txt.slice(0, 60) + '...' : txt || '-';
                    })()}
                  </td>
                  <td className={s['budgets__td'] + ' ' + s['budgets__total']}>
                    <CurrencyDisplay value={p.total} />
                  </td>
                  <td className={s['budgets__td']}>
                    {p.status === 'CONVERTED_TO_OT' ? (
                      <span className={s['budgets__status'] + ' ' + s['budgets__status--done']}>
                        CONCRETADO
                      </span>
                    ) : p.status === 'APPROVED' ? (
                      <span className={s['budgets__status'] + ' ' + s['budgets__status--approved']}>
                        APROBADO
                      </span>
                    ) : p.status === 'REJECTED' ? (
                      <span className={s['budgets__status'] + ' ' + s['budgets__status--rejected']}>
                        RECHAZADO
                      </span>
                    ) : p.type === 'online' ? (
                      <span
                        className={
                          s['budgets__status'] + ' ' + s['budgets__status--pending-online']
                        }
                      >
                        PENDIENTE - ONLINE
                      </span>
                    ) : (
                      <span className={s['budgets__status'] + ' ' + s['budgets__status--pending']}>
                        {translateStatus(p.status)}
                      </span>
                    )}
                  </td>
                  <td
                    className={s['budgets__td']}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  >
                    <div className={s['budgets__cell-actions']}>
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ padding: '3px 8px', fontSize: 11 }}
                        onClick={() =>
                          navigate(
                            p.type === 'online'
                              ? `/admin/online-budgets/${p.id}`
                              : `/admin/budgets/${p.id}`,
                          )
                        }
                      >
                        <Eye size={12} /> Ver
                      </button>
                      {['PENDING', 'ONLINE'].includes(p.status) && (
                        <button
                          type="button"
                          className="btn btn-success"
                          style={{ padding: '3px 8px', fontSize: 11 }}
                          onClick={() => handleCambiarEstado(p, 'APPROVED')}
                        >
                          Aprobar
                        </button>
                      )}
                      {p.status === 'APPROVED' && (
                        <button
                          type="button"
                          className="btn"
                          style={{ padding: '3px 8px', fontSize: 11, background: '#b91c1c', color: '#fff', border: 'none', borderRadius: 4 }}
                          onClick={() => p.type === 'online' ? handleConvertirOnline(p.id) : handleConvertir(p.id)}
                        >
                          <FileOutput size={11} /> Convertir a OT
                        </button>
                      )}
                      {p.type !== 'online' && p.status === 'CONVERTED_TO_OT' && p.workOrderNumber && (
                        <button
                          type="button"
                          className={s['budgets__ot']}
                          onClick={() => navigate(`/admin/work-orders?search=${p.workOrderNumber}`)}
                        >
                          OT {p.workOrderNumber}
                        </button>
                      )}
                      {['PENDING', 'ONLINE', 'APPROVED'].includes(p.status) && (
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: '3px 8px', fontSize: 11 }}
                          onClick={() => handleCambiarEstado(p, 'REJECTED')}
                        >
                          Rechazar
                        </button>
                      )}
                    </div>
                    <div className={s['budgets__cell-actions']}>
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ padding: '3px 8px', fontSize: 11 }}
                        onClick={() => handleOpenPdf(p)}
                      >
                        <FileDown size={12} /> PDF
                      </button>
                      <button
                        type="button"
                        className="btn btn-success"
                        style={{ padding: '3px 8px', fontSize: 11 }}
                        onClick={() => handleEnviarWhatsApp(p)}
                      >
                        <Send size={12} /> WhatsApp
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ padding: '3px 8px', fontSize: 11 }}
                        onClick={() => handleEnviarEmail(p.id)}
                      >
                        <Mail size={12} /> Email
                      </button>
                      <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: '3px 6px' }}
                          onClick={() => {
                            setDeleteId(p.id);
                            setDeleteTipo(p.type);
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <EmptyState message="No hay presupuestos" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar presupuesto"
        message="Estas seguro?"
        confirmLabel="Eliminar"
        danger
      />

      <ConfirmDialog
        open={!!pendingConvert}
        onCancel={() => setPendingConvert(null)}
        onConfirm={() => {
          if (pendingConvert) {
            const pc = pendingConvert;
            setPendingConvert(null);
            void performConvert(pc);
          }
        }}
        title="Convertir a Orden de Trabajo"
        message={
          pendingConvert?.tipo === 'online'
            ? 'Se convertira este presupuesto ONLINE en una Orden de Trabajo copiando todos los items.'
            : 'Se convertira este presupuesto en una Orden de Trabajo copiando toda la informacion (croquis, material, detalles, pileta, firma, precios y condiciones comerciales).'
        }
        confirmLabel="Convertir"
      />

      <PdfPreviewModal
        isOpen={!!pdfPreviewUrl || pdfPreviewLoading}
        onClose={handleClosePdfPreview}
        pdfUrl={pdfPreviewUrl}
        loading={pdfPreviewLoading}
        title={pdfPreviewTitle}
      />

      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} label="presupuestos" />
    </div>
  );
}