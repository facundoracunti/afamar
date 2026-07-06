import React, { useEffect, useRef } from 'react';

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string | null;
  loading: boolean;
  title?: string;
}

export default function PdfPreviewModal({ isOpen, onClose, pdfUrl, loading, title = 'Vista previa' }: PdfPreviewModalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!isOpen && iframeRef.current) {
      iframeRef.current.src = '';
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '90vw', height: '90vh',
          background: 'var(--surface-bg)', borderRadius: 8,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 20px', borderBottom: '1px solid var(--border-color)',
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{title}</h2>
          <button
            className="btn btn-outline"
            onClick={onClose}
            style={{ padding: '6px 14px', fontSize: 14 }}
          >
            ✕ Cerrar
          </button>
        </div>
        <div style={{ flex: 1, position: 'relative', background: 'var(--surface-alt-bg)' }}>
          {loading && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: 'color-mix(in srgb, var(--surface-alt-bg) 80%, transparent)', zIndex: 1,
              fontSize: 16, color: 'var(--text-muted)',
            }}>
              Generando PDF...
            </div>
          )}
          {pdfUrl && (
            <iframe
              ref={iframeRef}
              src={pdfUrl}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="Vista previa PDF"
            />
          )}
          {!loading && !pdfUrl && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: 'var(--text-muted)',
            }}>
              No se pudo generar la vista previa
            </div>
          )}
        </div>
      </div>
    </div>
  );
}