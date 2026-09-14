/**
 * PDF preview modal for the "FICHA DE TALLER" (workshop sheet).
 *
 * Same shell as `PdfPreviewModal` but renders the dedicated `WorkshopSheet`
 * document (no prices, no payment terms) so the operator can preview and
 * download the taller sheet from the work-orders list.
 */
import React from 'react';
import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import { Download } from 'lucide-react';
import WorkshopSheet from './WorkshopSheet';
import type { WorkshopPdfData } from '../../../utils/pdf/buildWorkshopPdfData';
import styles from './PdfPreviewModal.module.css';

const s = styles as unknown as Record<string, string>;

interface WorkshopPdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-built document data (output of `buildWorkshopPdfData`). */
  data?: WorkshopPdfData | null;
  loading: boolean;
  title?: string;
  fileName?: string;
}

export default function WorkshopPdfPreviewModal({
  isOpen,
  onClose,
  data,
  loading,
  title = 'Ficha de Taller',
  fileName = 'ficha_taller.pdf',
}: WorkshopPdfPreviewModalProps) {
  if (!isOpen) return null;

  return (
    <div className={s['pdf-modal-overlay']} onClick={onClose}>
      <div
        className={s['pdf-modal-content']}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className={s['pdf-modal-header']}>
          <h2 className={s['pdf-modal-title']}>{title}</h2>
          <div className={s['pdf-modal-actions']}>
            {data != null && !loading && (
              <PDFDownloadLink
                document={<WorkshopSheet data={data} />}
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
              <WorkshopSheet data={data} />
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