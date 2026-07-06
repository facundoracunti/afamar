import React from 'react';
import { Banknote } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';
import styles from './CashTotalCards.module.css';

const s = styles as unknown as Record<string, string>;

interface Props {
  suma: number;
  totalSalidas: number;
  saldoActualNum: number;
  efectivoReal: number;
}

export default function CashTotalCards({ suma, totalSalidas, saldoActualNum, efectivoReal }: Props) {
  return (
    <div className={s['cash-totals']}>
      <div className={`card ${s['cash-totals__card']}`}>
        <div className={s['cash-totals__label']}>Suma</div>
        <div className={s['cash-totals__value']}>{formatCurrency(suma)}</div>
        <div className={s['cash-totals__hint']}>Saldo Ant. + Ingresos</div>
      </div>
      <div className={`card ${s['cash-totals__card']}`}>
        <div className={s['cash-totals__label']}>Total Salidas</div>
        <div className={`${s['cash-totals__value']} ${s['cash-totals__value--expense']}`}>{formatCurrency(totalSalidas)}</div>
        <div className={s['cash-totals__hint']}>Suma de egresos del día</div>
      </div>
      <div className={`card ${s['cash-totals__card']}`}>
        <div className={s['cash-totals__label']}>Saldo Actual</div>
        <div className={`${s['cash-totals__value']} ${s['cash-totals__value--balance']}`}>{formatCurrency(saldoActualNum)}</div>
        <div className={s['cash-totals__hint']}>Suma - Salidas</div>
      </div>
      <div className={`card ${s['cash-totals__card']} ${s['cash-totals__highlight']}`}>
        <div className={s['cash-totals__highlight-label']}>
          <Banknote size={16} /> Caja del Día
        </div>
        <div className={s['cash-totals__highlight-value']}>{formatCurrency(efectivoReal)}</div>
        <div className={s['cash-totals__highlight-hint']}>
          Efectivo real en cajón (excluye TB)
        </div>
      </div>
    </div>
  );
}
