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
          background: '#fff', borderRadius: 8,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 20px', borderBottom: '1px solid #e5e7eb',
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{title}</h2>
          <button
            className="btn btn-outline"
            onClick={onClose}
            style={{ padding: '6px 14px', fontSize: 14 }}
          >
            ✕ Cerrar
          </button>
        </div>
        <div style={{ flex: 1, position: 'relative', background: '#f3f4f6' }}>
          {loading && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: 'rgba(243,244,246,0.8)', zIndex: 1,
              fontSize: 16, color: '#6b7280',
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
              fontSize: 14, color: '#9ca3af',
            }}>
              No se pudo generar la vista previa
            </div>
          )}
        </div>
      </div>
    </div>
  );
}