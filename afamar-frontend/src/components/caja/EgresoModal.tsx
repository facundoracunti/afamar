import React, { useState } from 'react';
import Modal from '../../components/common/Modal';
import { TIPOS_EGRESO } from './cajaUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (form: Record<string, unknown>) => Promise<void>;
}

export default function EgresoModal({ isOpen, onClose, onSubmit }: Props) {
  const [egresoForm, setEgresoForm] = useState<Record<string, unknown>>({
    concepto: '', monto: '', tipo_egreso: 'Gasto',
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!egresoForm.monto || Number(egresoForm.monto) <= 0) return;
    await onSubmit({
      date: '',
      type: 'EXPENSE',
      amount: Number(egresoForm.monto),
      description: egresoForm.concepto as string,
      expense_type: egresoForm.tipo_egreso as string,
    });
  };

  const resetForm = () => {
    setEgresoForm({ concepto: '', monto: '', tipo_egreso: 'Gasto' });
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { resetForm(); onClose(); }} title="Agregar Egreso" width="450px">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Concepto *</label>
          <input className="input" required placeholder="Ej: Nafta, Limpieza, Agua..."
            value={egresoForm.concepto as string}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEgresoForm({ ...egresoForm, concepto: e.target.value })} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Monto *</label>
            <input className="input" type="number" step="0.01" min="0" required
              value={egresoForm.monto as string}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEgresoForm({ ...egresoForm, monto: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Tipo</label>
            <select className="input" value={egresoForm.tipo_egreso as string}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEgresoForm({ ...egresoForm, tipo_egreso: e.target.value })}>
              {TIPOS_EGRESO.map((t: string) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 } as React.CSSProperties}>
          <button type="button" className="btn btn-outline" onClick={() => { resetForm(); onClose(); }}>Cancelar</button>
          <button type="submit" className="btn btn-danger">Registrar Egreso</button>
        </div>
      </form>
    </Modal>
  );
}
