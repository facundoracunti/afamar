import React, { useState } from 'react';
import { Modal } from '../../ui/Modal/Modal';
import { EXPENSE_TYPES } from '../../../constants';
import styles from './ExpenseModal.module.css';

const s = styles as unknown as Record<string, string>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (form: Record<string, unknown>) => Promise<void>;
}

export default function ExpenseModal({ isOpen, onClose, onSubmit }: Props) {
  const [expenseForm, setExpenseForm] = useState<Record<string, unknown>>({
    description: '', amount: '', expenseType: 'GENERAL',
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!expenseForm.amount || Number(expenseForm.amount) <= 0) return;
    await onSubmit({
      date: '',
      type: 'EXPENSE',
      amount: Number(expenseForm.amount),
      description: expenseForm.description as string,
      expense_type: expenseForm.expenseType as string,
    });
  };

  const resetForm = () => {
    setExpenseForm({ description: '', amount: '', expenseType: 'GENERAL' });
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { resetForm(); onClose(); }} title="Agregar Egreso" width="450px">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Concepto *</label>
          <input className="input" required placeholder="Ej: Nafta, Limpieza, Agua..."
            value={expenseForm.description as string}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExpenseForm({ ...expenseForm, description: e.target.value })} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Monto *</label>
            <input className="input" type="number" step="0.01" min="0" required
              value={expenseForm.amount as string}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Tipo</label>
            <select className="input" value={expenseForm.expenseType as string}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setExpenseForm({ ...expenseForm, expenseType: e.target.value })}>
              {EXPENSE_TYPES.map((t: string) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className={s['expense-modal__footer']}>
          <button type="button" className="btn btn-outline" onClick={() => { resetForm(); onClose(); }}>Cancelar</button>
          <button type="submit" className="btn btn-danger">Registrar Egreso</button>
        </div>
      </form>
    </Modal>
  );
}
