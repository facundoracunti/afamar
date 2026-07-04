import { Modal } from '../../ui/Modal';
import MaterialForm from './MaterialForm';

interface MaterialFormModalProps {
  isOpen: boolean;
  materialId?: number | string;
  onClose: () => void;
}

export function MaterialFormModal({ isOpen, materialId, onClose }: MaterialFormModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={materialId ? 'Editar Material' : 'Nuevo Material'}
      width="760px"
    >
      <MaterialForm
        materialId={materialId}
        onSaved={onClose}
        onCancel={onClose}
      />
    </Modal>
  );
}
