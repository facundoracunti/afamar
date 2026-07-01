import React from 'react';
import Modal from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ isOpen, onClose, onConfirm, title, message }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title || 'Confirmar'} width="400px">
      <p style={{ color: '#64748b', marginBottom: 24, fontSize: 14 } as React.CSSProperties}>
        {message}
      </p>
      <div
        style={
          {
            display: 'flex',
            gap: 12,
            justifyContent: 'flex-end',
          } as React.CSSProperties
        }
      >
        <button className="btn btn-outline" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn btn-danger" onClick={onConfirm}>
          Eliminar
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
