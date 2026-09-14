import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { Modal } from '../../ui/Modal/Modal';
import type { CashRegister, CashMovement } from '../../../types/cash';
import { formatCurrency } from '../../../utils/formatters';
import styles from './CloseCashModal.module.css';

const s = styles as unknown as Record<string, string>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (observaciones: string) => Promise<void>;
  numero?: number | null;
  totales?: CashRegister | null;
}

export default function CloseCashModal({ isOpen, onClose, onConfirm, numero, totales }: Props) {
  const [closeNotes, setCloseNotes] = useState<string>('');

  const handleConfirm = async () => {
    await onConfirm(closeNotes);
    setCloseNotes('');
  };

  const movements = (totales?.movements as CashMovement[] | undefined) || [];
  const ingresoCount = movements.filter((m) => m.type === 'INCOME').length;
  const egresoCount = movements.filter((m) => m.type === 'EXPENSE').length;

  return (
    <Modal isOpen={isOpen} onClose={() => { setCloseNotes(''); onClose(); }} title={`Cerrar Caja${numero != null ? ` #${numero}` : ''}`} width="520px">
      <p className={s['close-cash__description']}>
        Al cerrar esta caja se congelarán sus totales.{' '}
        {numero != null ? `Automáticamente se abrirá la caja #${numero + 1} para seguir trabajando.` : 'Automáticamente se abrirá la siguiente caja para seguir trabajando.'}
      </p>

      <div className={s['close-cash__summary']}>
        <div className={s['close-cash__summary-row']}>
          <span>Ingresos:</span>
          <strong className={s['close-cash__summary-income']}>{formatCurrency(totales?.total_income ?? 0)}</strong>
        </div>
        <div className={s['close-cash__summary-row']}>
          <span>Egresos:</span>
          <strong className={s['close-cash__summary-expense']}>{formatCurrency(totales?.total_expenses ?? 0)}</strong>
        </div>
        <div className={s['close-cash__summary-row']}>
          <span>Movimientos:</span>
          <strong>{ingresoCount} ingreso{ingresoCount === 1 ? '' : 's'} · {egresoCount} egreso{egresoCount === 1 ? '' : 's'}</strong>
        </div>
        <div className={`${s['close-cash__summary-row']} ${s['close-cash__summary-row--total']}`}>
          <span>Saldo Actual:</span>
          <strong className={s['close-cash__summary-total']}>{formatCurrency(totales?.current_balance ?? 0)}</strong>
        </div>
        <div className={`${s['close-cash__summary-row']} ${s['close-cash__summary-row--real']}`}>
          <span>Efectivo Real:</span>
          <strong className={s['close-cash__summary-real']}>{formatCurrency(totales?.real_cash ?? 0)}</strong>
        </div>
      </div>

      <div className="form-group">
        <label>Observaciones / Notas de la jornada (opcional)</label>
        <textarea className={`input ${s['close-cash__textarea']}`} rows={4}
          placeholder="Ej: Cobros de la sesión, incidencias, transferencias pendientes..."
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
