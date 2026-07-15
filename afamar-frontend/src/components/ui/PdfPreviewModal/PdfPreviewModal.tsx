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
import styles from './PdfPreviewModal.module.css';

const s = styles as unknown as Record<string, string>;

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
      className={s['pdf-modal-overlay']}
      onClick={onClose}
    >
      <div
        className={s['pdf-modal-content']}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className={s['pdf-modal-header']}>
          <h2 className={s['pdf-modal-title']}>{title}</h2>
          <div className={s['pdf-modal-actions']}>
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
        <div className={s['pdf-modal-body']}>
          {loading && (
            <div className={s['pdf-modal-loading']}>
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
            <div className={s['pdf-modal-empty']}>
              No se pudo generar la vista previa
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
