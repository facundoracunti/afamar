import React, { Suspense, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
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
import { usePaginatedList, useDelete } from '../../api/hooks';
import type { AxiosResponse } from 'axios';
import { useSettingsWithTerms } from '../../hooks/useSettingsWithTerms';
import { buildPdfData } from '../../utils/pdf/buildPdfData';
import type { PdfDocumentData } from '../../utils/pdf/buildPdfData';
import { mapApiToForm } from '../../hooks/entityFormHelpers';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import { PageHeader } from '../../components/ui/PageHeader/PageHeader';
import { Pagination } from '../../components/ui/Pagination';
const PdfPreviewModal = React.lazy(() => import('../../components/ui/PdfPreviewModal/PdfPreviewModal'));
const SketchImageExtractor = React.lazy(() => import('../../components/ui/PdfPreviewModal/SketchImageExtractor'));
import { useNotify } from '../../context/NotificationContext';
import BudgetTable from './BudgetTable';
import type { UnifiedBudget } from '../../types/budget';
import styles from './BudgetsListPage.module.css';

const s = styles as unknown as Record<string, string>;

const BUDGETS_KEY = ['budgets', 'unified'] as const;

interface PendingConvert {
  id: string | number;
}

export default function BudgetsList() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState(searchParams.get('status') || '');
  const [deleteId, setDeleteId] = useState<string | number | null>(null);
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
  const queryClient = useQueryClient();
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
      await deleteBudget(id as string);
    },
    { invalidateKeys: [BUDGETS_KEY] }
  );

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      notify('Presupuesto eliminado correctamente', 'success');
      setDeleteId(null);
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
      await updateBudget(String(budget.id), payload);
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
      const res = await convertBudgetToWorkOrder(pending.id as string);
      notify(`Orden ${(res.data as Record<string, unknown>).number as string} creada exitosamente`, 'success');
      // Both lists change: budget becomes CONVERTED_TO_OT, OT is created.
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'], refetchType: 'all' });
      navigate(`/admin/work-orders/${(res.data as Record<string, unknown>).id as string}`);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        || (err as Error).message
        || 'Error al convertir';
      notify(detail, 'error');
    }
  };

  const handleConvertir = (id: string | number) => {
    setPendingConvert({ id });
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
          <option value="APPROVED">Aprobado</option>
          <option value="REJECTED">Rechazado</option>
          <option value="CONVERTED_TO_OT">Convertido a OT</option>
          <option value="ALL">Todos</option>
        </select>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <BudgetTable
          data={data}
          onView={(p) => navigate(`/admin/budgets/${p.id}`)}
          onOpenPdf={handleOpenPdf}
          onConvertir={handleConvertir}
          onEnviarWhatsApp={handleEnviarWhatsApp}
          onEnviarEmail={handleEnviarEmail}
          onCambiarEstado={handleCambiarEstado}
          onSetDeleteId={setDeleteId}
        />
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
        message="Se convertira este presupuesto en una Orden de Trabajo copiando toda la informacion (croquis, material, detalles, pileta, firma, precios y condiciones comerciales)."
        confirmLabel="Convertir"
      />

      <Suspense fallback={<LoadingSpinner />}>
        <PdfPreviewModal
          isOpen={pdfData !== null || pdfPreviewLoading}
          onClose={handleClosePdfPreview}
          data={pdfData}
          loading={pdfPreviewLoading}
          title={pdfPreviewTitle}
          fileName={`presupuesto_${pendingFormData?.number || ''}.pdf`}
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

      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} label="presupuestos" />
    </div>
  );
}