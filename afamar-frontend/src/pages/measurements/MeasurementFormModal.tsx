/**
 * Modal wrapper of the measurement form used by the measurements list page.
 *
 * Extracted verbatim from `MeasurementsListPage.tsx`: same lazy chunk, same
 * modal title, same width, same close semantics.
 */
import React, { Suspense } from 'react';
import { Modal } from '../../components/ui/Modal/Modal';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';

const MeasurementForm = React.lazy(() => import('./MeasurementFormPage'));

/** Which measurement form the modal shows. */
export type MeasurementModal =
  | { kind: 'create' }
  | { kind: 'createFromWo'; workOrderId: number }
  | { kind: 'edit'; id: number };

interface MeasurementFormModalProps {
  modal: MeasurementModal;
  onClose: () => void;
}

export function MeasurementFormModal({ modal, onClose }: MeasurementFormModalProps) {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Modal
        isOpen
        onClose={onClose}
        title={
          modal.kind === 'edit'
            ? 'Editar Medición'
            : modal.kind === 'createFromWo'
              ? 'Nueva Medición (orden)'
              : 'Nueva Medición'
        }
        width="1100px"
      >
        {modal.kind === 'create' && (
          <MeasurementForm
            key="measurement-create"
            onSuccess={onClose}
            onCancel={onClose}
          />
        )}
        {modal.kind === 'createFromWo' && (
          <MeasurementForm
            key={`measurement-create-wo-${modal.workOrderId}`}
            presetWorkOrderId={modal.workOrderId}
            onSuccess={onClose}
            onCancel={onClose}
          />
        )}
        {modal.kind === 'edit' && (
          <MeasurementForm
            key={`measurement-edit-${modal.id}`}
            entityId={modal.id}
            onSuccess={onClose}
            onCancel={onClose}
          />
        )}
      </Modal>
    </Suspense>
  );
}
