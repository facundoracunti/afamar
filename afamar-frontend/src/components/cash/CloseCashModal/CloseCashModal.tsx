import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { Modal } from '../../ui/Modal/Modal';
import styles from './CloseCashModal.module.css';

const s = styles as unknown as Record<string, string>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (observaciones: string) => Promise<void>;
  fecha: string;
}

export default function CloseCashModal({ isOpen, onClose, onConfirm, fecha }: Props) {
  const [closeNotes, setCloseNotes] = useState<string>('');

  const handleConfirm = async () => {
    await onConfirm(closeNotes);
    setCloseNotes('');
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { setCloseNotes(''); onClose(); }} title="Cerrar Caja del Día" width="450px">
      <p className={s['close-cash__description']}>
        Al cerrar la caja se congelarán los totales del día <strong>{fecha}</strong>.
        No se podrán agregar ni eliminar movimientos una vez cerrada.
      </p>
      <div className="form-group">
        <label>Observaciones / Notas de la jornada (opcional)</label>
        <textarea className={`input ${s['close-cash__textarea']}`} rows={4}
          placeholder="Ej: Cobros del día, incidencias, transferencias pendientes..."
          value={closeNotes}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCloseNotes(e.target.value)} />
      </div>
      <div className={s['close-cash__footer']}>
        <button type="button" className="btn btn-outline" onClick={() => { setCloseNotes(''); onClose(); }}>Cancelar</button>
        <button type="button" className="btn btn-danger" onClick={handleConfirm}>
          <Lock size={14} className={s['close-cash__btn-icon']} /> Cerrar Caja
        </button>
      </div>
    </Modal>
  );
}
