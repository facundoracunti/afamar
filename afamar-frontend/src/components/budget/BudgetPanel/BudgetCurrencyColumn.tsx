import React, { useState } from 'react';
import { formatCurrency } from '../../../utils/formatters';
import { CurrencyDisplay } from '../../ui/CurrencyDisplay/CurrencyDisplay';
import type { EntityFormState } from '../../../types/form';
import styles from './BudgetPanel.module.css';

const s = styles as unknown as Record<string, string>;

interface BudgetCurrencyColumnProps {
  currency: 'ARS' | 'USD';
  form: EntityFormState;
  readOnly: boolean;
  onTransportChange: (value: string, source: 'ars' | 'usd') => void;
  onDepositCurrencyChange: (currency: string) => void;
  onDepositAmountChange: (value: string) => void;
}

export function BudgetCurrencyColumn({
  currency,
  form,
  readOnly,
  onTransportChange,
  onDepositCurrencyChange,
  onDepositAmountChange,
}: BudgetCurrencyColumnProps) {
  const isArs = currency === 'ARS';
  const [transportCurrency, setTransportCurrency] = useState<'ARS' | 'USD'>('ARS');

  const transportValue = transportCurrency === 'ARS'
    ? (Number(form.transport) > 0 ? String(form.transport) : '')
    : (Number(form.transport_usd) > 0 ? String(form.transport_usd) : '');
  const depositValue = (form.deposit_currency || 'ARS') === 'ARS'
    ? (Number(form.deposit_received) > 0 ? String(form.deposit_received) : '')
    : (Number(form.deposit_usd) > 0 ? String(form.deposit_usd) : '');

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

      {isArs ? (
        <div className="form-group">
          <label>Traslado</label>
          <div className={s['budget-panel__usd-summary-deposit']}>
            <select
              className={`input ${s['budget-panel__currency-switch-select']}`}
              value={transportCurrency}
              onChange={(e) => setTransportCurrency(e.target.value as 'ARS' | 'USD')}
              disabled={readOnly}
              aria-label="Moneda del traslado"
            >
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
            <input
              type="number"
              className={`input ${s['budget-panel__deposit-input']}`}
              value={transportValue}
              onChange={(e) => onTransportChange(e.target.value, transportCurrency === 'ARS' ? 'ars' : 'usd')}
              disabled={readOnly}
              placeholder="0"
            />
          </div>
        </div>
      ) : (
        <div className="form-group">
          <label>Seña recibida</label>
          <div className={s['budget-panel__usd-summary-deposit']}>
            <select
              className={`input ${s['budget-panel__currency-switch-select']}`}
              value={form.deposit_currency || 'ARS'}
              onChange={(e) => onDepositCurrencyChange(e.target.value)}
              disabled={readOnly}
              aria-label="Moneda de la seña"
            >
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
            <input
              type="number"
              className={`input ${s['budget-panel__deposit-input']}`}
              value={depositValue}
              onChange={(e) => onDepositAmountChange(e.target.value)}
              disabled={readOnly}
              placeholder="0"
            />
          </div>
        </div>
      )}
    </div>
  );
}
