import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import Modal from '../../components/common/Modal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (observaciones: string) => Promise<void>;
  fecha: string;
}

export default function CerrarCajaModal({ isOpen, onClose, onConfirm, fecha }: Props) {
  const [cerrarObs, setCerrarObs] = useState<string>('');

  const handleConfirm = async () => {
    await onConfirm(cerrarObs);
    setCerrarObs('');
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { setCerrarObs(''); onClose(); }} title="Cerrar Caja del Día" width="450px">
      <p style={{ fontSize: 14, color: '#475569', marginBottom: 16 } as React.CSSProperties}>
        Al cerrar la caja se congelarán los totales del día <strong>{fecha}</strong>.
        No se podrán agregar ni eliminar movimientos una vez cerrada.
      </p>
      <div className="form-group">
        <label>Observaciones / Notas de la jornada (opcional)</label>
        <textarea className="input" rows={4} style={{ resize: 'vertical' } as React.CSSProperties}
          placeholder="Ej: Cobros del día, incidencias, transferencias pendientes..."
          value={cerrarObs}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCerrarObs(e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 } as React.CSSProperties}>
        <button type="button" className="btn btn-outline" onClick={() => { setCerrarObs(''); onClose(); }}>Cancelar</button>
        <button type="button" className="btn btn-danger" onClick={handleConfirm}>
          <Lock size={14} style={{ marginRight: 4 } as React.CSSProperties} /> Cerrar Caja
        </button>
      </div>
    </Modal>
  );
}
