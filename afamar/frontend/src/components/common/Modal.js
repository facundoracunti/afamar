import React from 'react';

export default function Modal({ isOpen, onClose, title, children, width = '800px' }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: width }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} className="btn btn-outline" style={{ padding: '6px 10px' }}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
