import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, width = '800px' }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: width } as React.CSSProperties}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div
          style={
            {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
            } as React.CSSProperties
          }
        >
          <h2 style={{ fontSize: 20, fontWeight: 700 } as React.CSSProperties}>{title}</h2>
          <button
            onClick={onClose}
            className="btn btn-outline"
            style={{ padding: '6px 10px' } as React.CSSProperties}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export default Modal;
