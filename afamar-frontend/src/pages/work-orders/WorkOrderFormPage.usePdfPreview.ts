/**
 * PDF preview of the work order form.
 *
 * Owns the preview lifecycle: the operator asks for a preview, the sketch
 * extractor screenshots the canvas, the document data is built and the
 * modal is fed with it.
 */
import { useState } from 'react';
import { buildPdfData } from '../../utils/pdf/buildPdfData';
import type { CompanyInfo, PdfDocumentData, TermsInfo } from '../../utils/pdf/buildPdfData';
import { resolveTotalPaidArs } from '../../features/payments/utils/paymentParsing';
import type { EntityFormState } from '../../types';
import type { PaymentMethod } from '../../types/paymentMethod';

interface UseWorkOrderPdfPreviewParams {
  form: EntityFormState;
  company: CompanyInfo;
  globalTerms: TermsInfo;
  deliveryTerms: string[];
  warrantyTerms: string[];
  paymentMethods: PaymentMethod[];
  /** Pago abonado real (módulo de pagos), en ARS. */
  pagoAcumuladoModulo: number;
}

export function useWorkOrderPdfPreview({
  form,
  company,
  globalTerms,
  deliveryTerms,
  warrantyTerms,
  paymentMethods,
  pagoAcumuladoModulo,
}: UseWorkOrderPdfPreviewParams) {
  const [pdfData, setPdfData] = useState<PdfDocumentData | null>(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [sketchExtractorActive, setSketchExtractorActive] = useState(false);

  const handlePreviewPdf = () => {
    setPdfPreviewLoading(true);
    setPdfData(null);
    setSketchExtractorActive(true);
  };

  const handleSketchImagesReady = (images: string[]) => {
    // El preview del PDF muestra el pago abonado real en "Seña / Pagos
    // Registrados" y deriva el saldo (Paid + Saldo = TOTAL). El acumulado
    // del módulo ya es la verdad (reconcilia los movimientos del backend);
    // la seña del form en ARS es SOLO fallback legacy para OTs donde nunca
    // se registró un pago por módulo (nunca se suman, o el PDF duplicaría el
    // total: el depósito autocompletado ya = total + pagos del módulo).
    const depositEnArs =
      form.deposit_currency === 'USD' && Number(form.usd_rate) > 0
        ? (Number(form.deposit_usd) || 0) * Number(form.usd_rate)
        : (Number(form.deposit_received) || 0);
    const totalPaidArs = resolveTotalPaidArs(depositEnArs, pagoAcumuladoModulo);
    const data = buildPdfData({
      form: form as unknown as Record<string, unknown>,
      document_type: 'work_order',
      overrides: {
        delivery_terms: deliveryTerms,
        warranty_terms: warrantyTerms,
      },
      company,
      globalTerms,
      sketchImages: images,
      totalPaid: totalPaidArs,
      // Pasar el catálogo para que el PDF pueda aplicar la regla del
      // método (SURCHARGE) y emitir la tabla 3-columnas
      // de cuotas cuando hay tarjeta de crédito.
      paymentMethods,
    });
    setPdfData(data);
    setPdfPreviewLoading(false);
    setSketchExtractorActive(false);
  };

  const handleClosePdfPreview = () => {
    setPdfData(null);
    setSketchExtractorActive(false);
  };

  return {
    pdfData,
    pdfPreviewLoading,
    sketchExtractorActive,
    handlePreviewPdf,
    handleSketchImagesReady,
    handleClosePdfPreview,
  };
}
