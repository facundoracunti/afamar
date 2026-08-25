import { parseApiError } from '../utils/error';
import { Suspense, useState, lazy } from 'react';
import type { ReactNode } from 'react';

import { mapApiToForm } from './entityFormHelpers';
import { buildPdfData } from '../utils/pdf/buildPdfData';
import type { PdfDocumentData } from '../utils/pdf/buildPdfData';
import type { CompanyInfo, TermsInfo } from '../utils/pdf/pdfTypes';
import type { PaymentMethod } from '../types/paymentMethod';
import { LoadingSpinner } from '../components/ui/LoadingSpinner/LoadingSpinner';

const PdfPreviewModal = lazy(() => import('../components/ui/PdfPreviewModal/PdfPreviewModal'));
const SketchImageExtractor = lazy(() => import('../components/ui/PdfPreviewModal/SketchImageExtractor'));

interface UsePdfPreviewControllerParams {
  /** The entity type — drives the PDF layout. */
  documentType: 'budget' | 'work_order';
  /** Async function that fetches a single entity by id and returns its
   *  raw API data inside `.data`. */
  fetchEntity: (id: string | number) => Promise<{ data: Record<string, unknown> }>;
  /** Fallback status used when the entity has no status yet. */
  defaultStatus: string;
  /** Entity label for the modal title (e.g. "Presupuesto"). */
  label: string;
  /** Filename prefix for the downloaded PDF (e.g. "presupuesto_"). */
  fileNamePrefix: string;
  /** Company data (logo, name, address …). */
  company: CompanyInfo;
  /** Global terms to include in the PDF footer. */
  globalTerms: TermsInfo;
  /**
   * Active payment-method catalogue. Without it `buildPdfData` can't
   * resolve `payment_method_id` / `payment_method` to a row and the
   * preview silently drops the recargo / per-cuota table for credit
   * card payments. Pass `[]` only when you know the entity can't
   * have a SURCHARGE method.
   */
  paymentMethods?: PaymentMethod[];
  /** Notification callback for errors. */
  notify?: (msg: string, type: 'error' | 'success') => void;
}

interface UsePdfPreviewControllerReturn {
  pdfData: PdfDocumentData | null;
  pdfPreviewLoading: boolean;
  pdfPreviewTitle: string;
  sketchExtractorActive: boolean;
  pendingFormData: Record<string, unknown> | null;

  handleOpenPdf: (entity: { id: string | number; number?: string; status?: string }) => Promise<void>;
  handleSketchImagesReady: (images: string[]) => void;
  handleClosePdfPreview: () => void;

  /** Renders the PdfPreviewModal + SketchImageExtractor (must be placed
   *  inside the page's JSX). */
  UI: ReactNode;
}

export function usePdfPreviewController(params: UsePdfPreviewControllerParams): UsePdfPreviewControllerReturn {
  const { documentType, fetchEntity, defaultStatus, label, fileNamePrefix, company, globalTerms, paymentMethods = [], notify } = params;

  const [pdfData, setPdfData] = useState<PdfDocumentData | null>(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [pdfPreviewTitle, setPdfPreviewTitle] = useState<string>('Vista previa PDF');
  const [sketchExtractorActive, setSketchExtractorActive] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<Record<string, unknown> | null>(null);

  const handleOpenPdf = async (entity: { id: string | number; number?: string; status?: string }): Promise<void> => {
    setPdfPreviewLoading(true);
    setPdfPreviewTitle(`Vista previa — ${entity.number || label}`);
    setPdfData(null);
    try {
      const res = await fetchEntity(entity.id);
      const apiRow = res.data;
      const formData = mapApiToForm(apiRow, entity.status || defaultStatus);
      setPendingFormData(formData as unknown as Record<string, unknown>);
      setSketchExtractorActive(true);
    } catch (err: unknown) {
      notify?.(parseApiError(err, `Error al cargar ${label.toLowerCase()}`), 'error');
      setPdfPreviewLoading(false);
    }
  };

  const handleSketchImagesReady = (images: string[]): void => {
    if (!pendingFormData) { setPdfPreviewLoading(false); return; }
    const data = buildPdfData({
      form: pendingFormData,
      document_type: documentType,
      company,
      globalTerms,
      sketchImages: images,
      // Pass the catalogue so the helper can resolve the active
      // payment method to its rule and surface the per-cuota table
      // (and the catalogue-driven recargo / discount lines) even
      // when the form hook didn't run for this render path.
      paymentMethods,
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
        <PdfPreviewModal
          isOpen={pdfData !== null || pdfPreviewLoading}
          onClose={handleClosePdfPreview}
          data={pdfData}
          loading={pdfPreviewLoading}
          title={pdfPreviewTitle}
          fileName={`${fileNamePrefix}${pendingFormData?.number || ''}.pdf`}
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
    handleOpenPdf,
    handleSketchImagesReady,
    handleClosePdfPreview,
    UI,
  };
}
