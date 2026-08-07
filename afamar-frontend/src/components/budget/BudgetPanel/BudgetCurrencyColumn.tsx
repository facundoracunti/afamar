import React from 'react';
import { formatCurrency } from '../../../utils/formatters';
import { CurrencyDisplay } from '../../ui/CurrencyDisplay/CurrencyDisplay';
import type { EntityFormState } from '../../../types/form';
import styles from './BudgetPanel.module.css';

const s = styles as unknown as Record<string, string>;

interface BudgetCurrencyColumnProps {
  currency: 'ARS' | 'USD';
  form: EntityFormState;
  readOnly: boolean;
}

export function BudgetCurrencyColumn({
  currency,
  form,
}: BudgetCurrencyColumnProps) {
  const isArs = currency === 'ARS';

  const summaryValueClasses = `${s['budget-panel__usd-summary-value']} ${isArs ? s['budget-panel__balance-value--ars'] : s['budget-panel__usd-summary-value--usd']}`;

  return (
    <div className={s['budget-panel__col']}>
      <div className={s['budget-panel__usd-summary']}>
        <div className={s['budget-panel__usd-summary-row']}>
          <div className={s['budget-panel__usd-summary-cell']}>
            <div className={s['budget-panel__usd-summary-label']}>SUBTOTALES ({currency})</div>
            <div className={summaryValueClasses}>
              {isArs
                ? formatCurrency(form.subtotal)
                : <CurrencyDisplay value={form.subtotal_usd} currency="USD" />}
            </div>
          </div>
          <div className={s['budget-panel__usd-summary-cell']}>
            <div className={s['budget-panel__usd-summary-label']}>TOTAL {currency}</div>
            <div className={summaryValueClasses}>
              {isArs
                ? formatCurrency(form.total)
                : <CurrencyDisplay value={form.total_usd} currency="USD" />}
            </div>
          </div>
        </div>
        <div className={`${s['budget-panel__usd-summary-row']} ${s['budget-panel__usd-summary-row--single']}`}>
          <div className={s['budget-panel__usd-summary-cell']}>
            <div className={s['budget-panel__usd-summary-label']}>SALDO PENDIENTE {currency}</div>
            <div className={summaryValueClasses}>
              {isArs
                ? formatCurrency(form.balance_due)
                : <CurrencyDisplay value={form.balance_due_usd} currency="USD" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
