/**
 * PDF preview modal — supports two rendering modes:
 *
 * 1. **react-pdf mode** (active): pass `data: PdfDocumentData` and the
 *    modal renders the document with `<PDFViewer>` (interactive preview +
 *    download button). Used by BudgetFormPage, WorkOrderFormPage,
 *    BudgetsListPage and WorkOrdersListPage — the PDF is built entirely
 *    in the browser from form state or from the GET response.
 *
 * 2. **blob URL mode** (legacy, kept for forward compat): pass
 *    `pdfUrl: string` (a Blob URL) and the modal shows it in an `<iframe>`.
 *    No current consumer — the backend no longer serves PDF blobs.
 *
 * The two modes are mutually exclusive — whichever prop is provided wins.
 */
import React, { useEffect, useRef } from 'react';
import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import { Download } from 'lucide-react';
import DocumentPdf from './DocumentPdf';
import type { PdfDocumentData } from '../../../utils/pdf/buildPdfData';

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** react-pdf mode: pre-built document data. */
  data?: PdfDocumentData | null;
  /** Blob URL mode: URL to a PDF served by the backend. */
  pdfUrl?: string | null;
  loading: boolean;
  title?: string;
  fileName?: string;
}

export default function PdfPreviewModal({
  isOpen,
  onClose,
  data,
  pdfUrl,
  loading,
  title = 'Vista previa',
  fileName = 'documento.pdf',
}: PdfPreviewModalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!isOpen && iframeRef.current) {
      iframeRef.current.src = '';
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const hasReactPdf = data != null;
  const hasBlobUrl = pdfUrl != null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '90vw',
          height: '90vh',
          background: 'var(--surface-bg)',
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 20px',
            borderBottom: '1px solid var(--border-color)',
            gap: 12,
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{title}</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {hasReactPdf && !loading && (
              <PDFDownloadLink
                document={<DocumentPdf data={data} />}
                fileName={fileName}
                className="btn btn-primary"
                style={{ padding: '6px 14px', fontSize: 14 }}
              >
                {({ loading: dlLoading }) => (
                  <>
                    <Download size={16} /> {dlLoading ? 'Preparando...' : 'Descargar'}
                  </>
                )}
              </PDFDownloadLink>
            )}
            <button
              className="btn btn-outline"
              onClick={onClose}
              style={{ padding: '6px 14px', fontSize: 14 }}
            >
              ✕ Cerrar
            </button>
          </div>
        </div>
        <div style={{ flex: 1, position: 'relative', background: 'var(--surface-alt-bg)' }}>
          {loading && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'color-mix(in srgb, var(--surface-alt-bg) 80%, transparent)',
                zIndex: 1,
                fontSize: 16,
                color: 'var(--text-muted)',
              }}
            >
              Generando PDF...
            </div>
          )}
          {hasReactPdf && !loading && (
            <PDFViewer
              style={{ width: '100%', height: '100%', border: 'none' }}
              showToolbar
            >
              <DocumentPdf data={data} />
            </PDFViewer>
          )}
          {hasBlobUrl && !hasReactPdf && pdfUrl && (
            <iframe
              ref={iframeRef}
              src={pdfUrl}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="Vista previa PDF"
            />
          )}
          {!loading && !hasReactPdf && !hasBlobUrl && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                color: 'var(--text-muted)',
              }}
            >
              No se pudo generar la vista previa
            </div>
          )}
        </div>
      </div>
    </div>
  );
}