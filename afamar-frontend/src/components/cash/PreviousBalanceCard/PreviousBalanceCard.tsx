import React from 'react';
import { Wallet } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';
import styles from './PreviousBalanceCard.module.css';

const s = styles as unknown as Record<string, string>;

interface Props {
  previousBalance: number;
  cerrada: boolean;
  editMode: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onChange: (value: number) => void;
}

export default function PreviousBalanceCard({ previousBalance, cerrada, editMode, onEdit, onCancel, onSave, onChange }: Props) {
  return (
    <div className={`card ${s['previous-balance']}`}>
      <Wallet size={22} className={s['previous-balance__icon']} />
      <span className={s['previous-balance__label']}>Saldo Anterior:</span>
      {editMode ? (
        <div className={`no-print ${s['previous-balance__edit-row']}`}>
          <input
            className="input"
            type="number"
            step="0.01"
            value={previousBalance}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))}
            autoFocus
          />
          <button className="btn btn-primary" onClick={onSave}>Guardar</button>
          <button className="btn btn-outline" onClick={onCancel}>Cancelar</button>
        </div>
      ) : (
        <div className={s['previous-balance__display']}>
          <span className={s['previous-balance__amount']}>{formatCurrency(previousBalance)}</span>
          {!cerrada && (
            <button className={`btn btn-outline no-print ${s['previous-balance__btn-edit']}`} onClick={onEdit}>Editar</button>
          )}
        </div>
      )}
    </div>
  );
}
