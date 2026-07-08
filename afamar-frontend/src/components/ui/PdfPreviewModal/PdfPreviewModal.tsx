/**
 * PDF preview modal — renders a `@react-pdf/renderer` document inside a
 * `<PDFViewer>` so the user can page through it before downloading.
 *
 * All four callers (BudgetFormPage, WorkOrderFormPage, BudgetsListPage
 * and WorkOrdersListPage) build the document data on the fly via
 * `buildPdfData()` and pass it in `data`. The modal hands it to
 * `<DocumentPdf>` and exposes a Download button via `<PDFDownloadLink>`.
 *
 * The legacy `pdfUrl` (iframe + blob URL) mode was removed in Ola 3 of
 * the issue tracker — the backend no longer serves PDF blobs and no
 * caller was using the iframe path.
 */
import React from 'react';
import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import { Download } from 'lucide-react';
import DocumentPdf from './DocumentPdf';
import type { PdfDocumentData } from '../../../utils/pdf/buildPdfData';

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-built document data (output of `buildPdfData`). */
  data?: PdfDocumentData | null;
  loading: boolean;
  title?: string;
  fileName?: string;
}

export default function PdfPreviewModal({
  isOpen,
  onClose,
  data,
  loading,
  title = 'Vista previa',
  fileName = 'documento.pdf',
}: PdfPreviewModalProps) {
  if (!isOpen) return null;

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
            {data != null && !loading && (
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
          {data != null && !loading && (
            <PDFViewer
              style={{ width: '100%', height: '100%', border: 'none' }}
              showToolbar
            >
              <DocumentPdf data={data} />
            </PDFViewer>
          )}
          {!loading && data == null && (
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
