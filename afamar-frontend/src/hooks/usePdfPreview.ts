import { useState, useCallback } from 'react';

interface PdfPreviewState {
  pdfPreviewUrl: string | null;
  pdfPreviewLoading: boolean;
}

export function usePdfPreview(
  notify?: (msg: string, type: 'error' | 'success') => void,
  entityLabel?: string
) {
  const [state, setState] = useState<PdfPreviewState>({
    pdfPreviewUrl: null,
    pdfPreviewLoading: false,
  });

  const handlePreviewPdf = useCallback(
    async (previewFn: () => Promise<{ data: Blob }>) => {
      setState({ pdfPreviewUrl: null, pdfPreviewLoading: true });
      try {
        const res = await previewFn();
        const blob = res.data as Blob;
        const url = URL.createObjectURL(blob);
        setState({ pdfPreviewUrl: url, pdfPreviewLoading: false });
      } catch (err: unknown) {
        const responseData = (err as { response?: { data?: unknown; status?: number } }).response?.data;
        const status = (err as { response?: { status?: number } }).response?.status;
        let detail: string | undefined;
        if (typeof responseData === 'string') {
          detail = responseData;
        } else if (responseData && typeof responseData === 'object') {
          const obj = responseData as Record<string, unknown>;
          if (typeof obj.detail === 'string') detail = obj.detail;
          else if (typeof obj.error === 'string') detail = obj.error;
        }
        const label = entityLabel || 'PDF';
        const suffix = status ? ` (status ${status})` : '';
        console.error(`Error al generar vista previa del ${label}:`, err);
        notify?.(detail ? `${detail}${suffix}` : `Error al generar la vista previa del ${label}${suffix}`, 'error');
        setState({ pdfPreviewUrl: null, pdfPreviewLoading: false });
      }
    },
    [notify, entityLabel]
  );

  const handleClosePdfPreview = useCallback(() => {
    setState((prev) => {
      if (prev.pdfPreviewUrl) URL.revokeObjectURL(prev.pdfPreviewUrl);
      return { pdfPreviewUrl: null, pdfPreviewLoading: false };
    });
  }, []);

  return {
    pdfPreviewUrl: state.pdfPreviewUrl,
    pdfPreviewLoading: state.pdfPreviewLoading,
    handlePreviewPdf,
    handleClosePdfPreview,
  };
}
