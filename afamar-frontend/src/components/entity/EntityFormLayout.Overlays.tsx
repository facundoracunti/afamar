/**
 * Overlays of the shared entity form layout: the lazy PDF preview modal,
 * the lazy sketch image extractor (auto-screenshots the canvas for the PDF),
 * the delete confirmation dialog and the page-specific extra dialogs.
 */
import React, { Suspense, type ReactNode } from 'react';
import { ConfirmDialog } from '../ui/ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../ui/LoadingSpinner/LoadingSpinner';
import { useEntityFormActions, useEntityFormState } from './EntityFormContexts';

const PdfPreviewModal = React.lazy(() => import('../ui/PdfPreviewModal/PdfPreviewModal'));
const SketchImageExtractor = React.lazy(() => import('../ui/PdfPreviewModal/SketchImageExtractor'));

interface EntityFormLayoutOverlaysProps {
  extraDialogs?: ReactNode;
}

export default function EntityFormLayoutOverlays({ extraDialogs }: EntityFormLayoutOverlaysProps) {
  const { form } = useEntityFormState();
  const {
    pdfData, pdfPreviewLoading, handleClosePdfPreview, pdfTitle, pdfFileName,
    sketchExtractorActive, handleSketchImagesReady,
    deleteConfirm, setDeleteConfirm, handleDelete,
    deleteTitle, deleteMessage, deleteConfirmLabel, deleteDanger,
  } = useEntityFormActions();

  return (
    <>
      <Suspense fallback={<LoadingSpinner />}>
        <PdfPreviewModal
          isOpen={pdfData !== null || pdfPreviewLoading}
          onClose={handleClosePdfPreview}
          data={pdfData}
          loading={pdfPreviewLoading}
          title={pdfTitle}
          fileName={pdfFileName}
        />
      </Suspense>

      {sketchExtractorActive && (
        <Suspense fallback={null}>
          <SketchImageExtractor
            sketchElements={form.sketch_elements}
            onReady={handleSketchImagesReady}
          />
        </Suspense>
      )}

      <ConfirmDialog
        open={deleteConfirm}
        onCancel={() => setDeleteConfirm(false)}
        onConfirm={handleDelete}
        title={deleteTitle}
        message={deleteMessage}
        confirmLabel={deleteConfirmLabel}
        danger={deleteDanger}
      />

      {extraDialogs}
    </>
  );
}
