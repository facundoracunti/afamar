import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Trash2, FileDown, FileOutput, Eye, Send, Mail, Check, X } from 'lucide-react';
import {
  getBudgetsUnified,
  getBudget,
  deleteBudget,
  updateBudget,
  convertBudgetToWorkOrder,
  getBudgetPdf,
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
import { useSettingsWithTerms } from '../../hooks/useSettingsWithTerms';
import { buildPdfData } from '../../utils/pdf/buildPdfData';
import type { PdfDocumentData } from '../../utils/pdf/buildPdfData';
import { mapApiToForm } from '../../hooks/entityFormHelpers';
import CurrencyDisplay from '../../components/ui/CurrencyDisplay';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import { PageHeader } from '../../components/ui/PageHeader/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { Pagination } from '../../components/ui/Pagination';
import PdfPreviewModal from '../../components/ui/PdfPreviewModal/PdfPreviewModal';
import SketchImageExtractor from '../../components/ui/PdfPreviewModal/SketchImageExtractor';
import { useNotify } from '../../context/NotificationContext';
import type { UnifiedBudget } from '../../types/budget';
import styles from './BudgetsListPage.module.css';

const s = styles as unknown as Record<string, string>;

const BUDGETS_KEY = ['budgets', 'unified'] as const;

interface PendingConvert {
  id: string | number;
  tipo: 'online' | 'local';
}

/**
 * Reusable class for "secondary" outline buttons rendered in the actions
 * columns. Keeps the TSX concise and prevents inline-style duplication.
 */
const btnCls = (variant?: 'success' | 'danger' | 'info' | 'ghost') => {
  const base = s['budgets__action-btn'];
  if (!variant) return base;
  if (variant === 'success') return `${base} ${s['budgets__action-btn--success']}`;
  if (variant === 'danger') return `${base} ${s['budgets__action-btn--danger']}`;
  if (variant === 'info') return `${base} ${s['budgets__action-btn--info']}`;
  return `${base} ${s['budgets__action-btn--ghost']}`;
};

export default function BudgetsList() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState(searchParams.get('status') || '');
  const [deleteId, setDeleteId] = useState<string | number | null>(null);
  const [deleteTipo, setDeleteTipo] = useState<string | null>(null);
  const [pendingConvert, setPendingConvert] = useState<PendingConvert | null>(null);
  const [pdfData, setPdfData] = useState<PdfDocumentData | null>(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [pdfPreviewTitle, setPdfPreviewTitle] = useState<string>('Vista previa PDF');
  const [sketchExtractorActive, setSketchExtractorActive] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    setEstado(searchParams.get('status') || '');
  }, [searchParams]);

  const notify = useNotify();
  const { company, globalTerms } = useSettingsWithTerms();

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
    const phone = (presupuesto.clientPhone || '').replace(/[^\d]/g, '');
    const nombre = presupuesto.clientName || '';
    const pdfUrl = getBudgetPdf(presupuesto.id as unknown as string);
    const saludo = nombre ? `Hola ${nombre}! ` : '';
    const mensaje = `${saludo}Te enviamos el presupuesto formal de AFAMAR Marmoles & Granitos. Podes revisarlo e imprimirlo desde el siguiente link: ${pdfUrl}`;
    const whatsappUrl = phone
      ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(mensaje)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleEnviarEmail = async (id: string | number) => {
    try {
      await sendBudgetEmail(id as string);
      notify('Correo enviado correctamente', 'success');
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
    setPdfData(null);
    try {
      const res = await getBudget(budget.id);
      // Run the raw API response through the same mapper the edit form
      // uses (`mapApiToForm`). That gives us a fully-typed
      // `EntityFormState` with dates sliced, JSON-encoded *_data fields
      // parsed, and — most importantly for this fix — `sketch_elements`
      // decoded into the page-list the SketchImageExtractor expects.
      // Without this step, the extractor receives the raw relationship
      // and the legacy `budgeted_details` text column and silently produces
      // zero pages (no croquis in the PDF).
      const apiRow = (res as unknown as { data: Record<string, unknown> }).data;
      const formData = mapApiToForm(apiRow, budget.status || 'PENDING');
      setPendingFormData(formData as unknown as Record<string, unknown>);
      setSketchExtractorActive(true);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        || (err as Error).message
        || 'Error al cargar el presupuesto';
      notify(detail, 'error');
      setPdfPreviewLoading(false);
    }
  };

  const handleSketchImagesReady = (images: string[]) => {
    if (!pendingFormData) { setPdfPreviewLoading(false); return; }
    const data = buildPdfData({
      form: pendingFormData,
      document_type: 'budget',
      company,
      globalTerms,
      sketchImages: images,
    });
    setPdfData(data);
    setPdfPreviewLoading(false);
    setSketchExtractorActive(false);
  };

  const handleClosePdfPreview = () => {
    setPdfData(null);
    setSketchExtractorActive(false);
    setPendingFormData(null);
  };

  // Helpers ------------------------------------------------------------------

  const isConvertible = (p: UnifiedBudget): boolean =>
    p.status === 'APPROVED' && !p.workOrderNumber;

  const canAprobar = (p: UnifiedBudget): boolean =>
    p.status === 'PENDING' || p.status === 'ONLINE';

  const canRechazar = (p: UnifiedBudget): boolean =>
    p.status === 'PENDING' || p.status === 'ONLINE' || p.status === 'APPROVED';

  const handleView = (p: UnifiedBudget): void => {
    navigate(p.type === 'online' ? `/admin/online-budgets/${p.id}` : `/admin/budgets/${p.id}`);
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
            placeholder="Buscar por Nro / Cliente / Teléfono / Material..."
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
                <th className={s['budgets__th']} style={{ width: 90 }}>Número</th>
                <th className={s['budgets__th']} style={{ width: 95, fontSize: 12 }}>Fecha</th>
                <th className={s['budgets__th']} style={{ width: 160 }}>Cliente</th>
                <th className={s['budgets__th']} style={{ width: 110 }}>Telefono</th>
                <th className={s['budgets__th']} style={{ width: 110 }}>Total</th>
                <th className={s['budgets__th']} style={{ width: 100 }}>Estado</th>
                <th className={s['budgets__th']} style={{ width: 130 }}>Flujo</th>
                <th className={s['budgets__th']} style={{ width: 140 }}>Convertir OT</th>
                <th className={s['budgets__th']} style={{ width: 130 }}>Vista</th>
                <th className={s['budgets__th']} style={{ width: 150 }}>Notificar</th>
                <th className={s['budgets__th']} style={{ width: 70 }}>Eliminar</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p: UnifiedBudget) => (
                <tr
                  key={p.type + '-' + p.id}
                  className={s['budgets__row']}
                  onClick={() => handleView(p)}
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
                      <span className={s['budgets__status'] + ' ' + s['budgets__status--pending-online']}>
                        PENDIENTE - ONLINE
                      </span>
                    ) : (
                      <span className={s['budgets__status'] + ' ' + s['budgets__status--pending']}>
                        {translateStatus(p.status)}
                      </span>
                    )}
                  </td>

                  {/* Column 7 — Flujo: Aprobar / Rechazar */}
                  <td
                    className={`${s['budgets__td']} ${s['budgets__actions-cell']}`}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  >
                    <div className={s['budgets__action-pair']}>
                      {canAprobar(p) && (
                        <button
                          type="button"
                          className={btnCls('success')}
                          onClick={() => handleCambiarEstado(p, 'APPROVED')}
                          title="Aprobar presupuesto"
                        >
                          <Check size={12} /> Aprobar
                        </button>
                      )}
                      {canRechazar(p) && (
                        <button
                          type="button"
                          className={btnCls('danger')}
                          onClick={() => handleCambiarEstado(p, 'REJECTED')}
                          title="Rechazar presupuesto"
                        >
                          <X size={12} /> Rechazar
                        </button>
                      )}
                      {!canAprobar(p) && !canRechazar(p) && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>}
                    </div>
                  </td>

                  {/* Column 8 — Convertir a OT */}
                  <td
                    className={`${s['budgets__td']} ${s['budgets__actions-cell']}`}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  >
                    {isConvertible(p) ? (
                      <button
                        type="button"
                        className={btnCls('danger')}
                        onClick={() =>
                          p.type === 'online' ? handleConvertirOnline(p.id) : handleConvertir(p.id)
                        }
                        title="Convertir presupuesto en Orden de Trabajo"
                      >
                        <FileOutput size={11} /> A OT
                      </button>
                    ) : p.workOrderNumber ? (
                      <button
                        type="button"
                        className={btnCls('ghost')}
                        onClick={() => navigate(`/admin/work-orders?search=${p.workOrderNumber}`)}
                        title={`Ver Orden de Trabajo ${p.workOrderNumber}`}
                      >
                        OT {p.workOrderNumber}
                      </button>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
                    )}
                  </td>

                  {/* Column 9 — Vista: Ver / PDF */}
                  <td
                    className={`${s['budgets__td']} ${s['budgets__actions-cell']}`}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  >
                    <div className={s['budgets__action-pair']}>
                      <button
                        type="button"
                        className={btnCls()}
                        onClick={() => handleView(p)}
                        title="Ver / editar"
                      >
                        <Eye size={12} /> Ver
                      </button>
                      <button
                        type="button"
                        className={btnCls()}
                        onClick={() => handleOpenPdf(p)}
                        title="Vista previa del PDF"
                      >
                        <FileDown size={12} /> PDF
                      </button>
                    </div>
                  </td>

                  {/* Column 10 — Notificar: WhatsApp / Correo */}
                  <td
                    className={`${s['budgets__td']} ${s['budgets__actions-cell']}`}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  >
                    <div className={s['budgets__action-pair']}>
                      {p.clientPhone ? (
                        <button
                          type="button"
                          className={btnCls('success')}
                          onClick={() => handleEnviarWhatsApp(p)}
                          title={`Enviar por WhatsApp a ${p.clientPhone}`}
                        >
                          <Send size={12} /> WhatsApp
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={btnCls()}
                          disabled
                          style={{ opacity: 0.4, cursor: 'not-allowed' }}
                          title="Sin teléfono cargado"
                        >
                          <Send size={12} /> WhatsApp
                        </button>
                      )}
                      <button
                        type="button"
                        className={btnCls('info')}
                        onClick={() => handleEnviarEmail(p.id)}
                        title="Enviar PDF por correo"
                      >
                        <Mail size={12} />Correo</button>
                    </div>
                  </td>

                  {/* Column 11 — Eliminar */}
                  <td
                    className={`${s['budgets__td']} ${s['budgets__actions-cell']}`}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className={btnCls('danger')}
                      onClick={() => {
                        setDeleteId(p.id);
                        setDeleteTipo(p.type);
                      }}
                      title="Eliminar presupuesto"
                      style={{ padding: '4px 8px' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={11}>
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
        isOpen={pdfData !== null || pdfPreviewLoading}
        onClose={handleClosePdfPreview}
        data={pdfData}
        loading={pdfPreviewLoading}
        title={pdfPreviewTitle}
        fileName={`presupuesto_${pendingFormData?.number || ''}.pdf`}
      />

      {sketchExtractorActive && pendingFormData && (
        <SketchImageExtractor
          sketchElements={pendingFormData.sketch_elements}
          onReady={handleSketchImagesReady}
        />
      )}

      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} label="presupuestos" />
    </div>
  );
}