import { parseApiError } from '../utils/error';
import { Suspense, useState, lazy } from 'react';
import type { ReactNode } from 'react';

import { mapApiToForm } from './entityFormHelpers';
import { buildWorkshopPdfData } from '../utils/pdf/buildWorkshopPdfData';
import type { WorkshopPdfData } from '../utils/pdf/buildWorkshopPdfData';
import type { CompanyInfo } from '../utils/pdf/pdfTypes';
import { LoadingSpinner } from '../components/ui/LoadingSpinner/LoadingSpinner';

const WorkshopPdfPreviewModal = lazy(() => import('../components/ui/PdfPreviewModal/WorkshopPdfPreviewModal'));
const SketchImageExtractor = lazy(() => import('../components/ui/PdfPreviewModal/SketchImageExtractor'));

interface UseWorkshopPdfControllerParams {
  /** Async function that fetches a single work order by id and returns its
   *  raw API data inside `.data`. */
  fetchEntity: (id: string | number) => Promise<{ data: Record<string, unknown> }>;
  /** Fallback status used when the entity has no status yet. */
  defaultStatus: string;
  /** Company data (logo, name, address …). */
  company: CompanyInfo;
  /** Notification callback for errors. */
  notify?: (msg: string, type: 'error' | 'success') => void;
}

interface UseWorkshopPdfControllerReturn {
  pdfData: WorkshopPdfData | null;
  pdfPreviewLoading: boolean;
  pdfPreviewTitle: string;
  sketchExtractorActive: boolean;
  pendingFormData: Record<string, unknown> | null;

  handleOpenWorkshopSheet: (
    entity: { id: string | number; number?: string; status?: string },
    options?: { liveForm?: Record<string, unknown> }
  ) => Promise<void>;
  handleSketchImagesReady: (images: string[]) => void;
  handleClosePdfPreview: () => void;

  /** Renders the WorkshopPdfPreviewModal + SketchImageExtractor (must be
   *  placed inside the page's JSX). */
  UI: ReactNode;
}

export function useWorkshopPdfController(params: UseWorkshopPdfControllerParams): UseWorkshopPdfControllerReturn {
  const { fetchEntity, defaultStatus, company, notify } = params;

  const [pdfData, setPdfData] = useState<WorkshopPdfData | null>(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [pdfPreviewTitle, setPdfPreviewTitle] = useState<string>('Ficha de Taller');
  const [sketchExtractorActive, setSketchExtractorActive] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<Record<string, unknown> | null>(null);

  const handleOpenWorkshopSheet = async (
    entity: { id: string | number; number?: string; status?: string },
    options?: { liveForm?: Record<string, unknown> }
  ): Promise<void> => {
    setPdfPreviewLoading(true);
    setPdfPreviewTitle(`Ficha de Taller — ${entity.number || ''}`);
    setPdfData(null);
    try {
      // The form page passes its LIVE `form` slice so unsaved edits (e.g.
      // assigning each pool to a specific mesada in "Asignar a opción")
      // are reflected in the sheet. The list page omits `liveForm`, so we
      // re-fetch from the API and normalize through `mapApiToForm`.
      const formData = options?.liveForm
        ? options.liveForm
        : (mapApiToForm(
            (await fetchEntity(entity.id)).data,
            entity.status || defaultStatus
          ) as unknown as Record<string, unknown>);
      setPendingFormData(formData);
      setSketchExtractorActive(true);
    } catch (err: unknown) {
      notify?.(parseApiError(err, 'Error al cargar la ficha de taller'), 'error');
      setPdfPreviewLoading(false);
    }
  };

  const handleSketchImagesReady = (images: string[]): void => {
    if (!pendingFormData) { setPdfPreviewLoading(false); return; }
    const data = buildWorkshopPdfData({
      form: pendingFormData,
      company,
      sketchImages: images,
      defaultNumber: String(pendingFormData.number || pendingFormData.work_order_number || ''),
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

  const UI = (
    <>
      <Suspense fallback={<LoadingSpinner />}>
        <WorkshopPdfPreviewModal
          isOpen={pdfData !== null || pdfPreviewLoading}
          onClose={handleClosePdfPreview}
          data={pdfData}
          loading={pdfPreviewLoading}
          title={pdfPreviewTitle}
          fileName={`ficha_taller_${String(pendingFormData?.number || pendingFormData?.work_order_number || '').trim()}.pdf`}
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
    </>
  );

  return {
    pdfData,
    pdfPreviewLoading,
    pdfPreviewTitle,
    sketchExtractorActive,
    pendingFormData,
    handleOpenWorkshopSheet,
    handleSketchImagesReady,
    handleClosePdfPreview,
    UI,
  };
}