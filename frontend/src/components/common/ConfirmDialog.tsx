import React from 'react';
import Modal from './Modal';

export default function ConfirmDialog({ isOpen, onClose, onConfirm, title, message }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title || 'Confirmar'} width="400px">
      <p style={{ color: '#64748b', marginBottom: 24, fontSize: 14 }}>{message}</p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
        <button className="btn btn-danger" onClick={onConfirm}>Eliminar</button>
      </div>
    </Modal>
  );
}
