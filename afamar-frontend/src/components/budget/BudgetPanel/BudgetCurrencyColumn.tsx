import React from 'react';
import { formatCurrency } from '../../../utils/formatters';
import { CurrencyDisplay } from '../../ui/CurrencyDisplay/CurrencyDisplay';
import { t } from '../../../utils/translate';
import type { EntityFormState } from '../../../types/form';
import type { FabricationDetail, MaterialInForm, PoolInForm } from '../../../types/budget';
import styles from './BudgetPanel.module.css';

const s = styles as unknown as Record<string, string>;

interface BudgetCurrencyColumnProps {
  currency: 'ARS' | 'USD';
  form: EntityFormState;
  fabricationDetails: FabricationDetail[];
  materialsAll: MaterialInForm[];
  poolsAll: PoolInForm[];
  readOnly: boolean;
  onTransportChange: (value: string, source: 'ars' | 'usd') => void;
  onDepositAmountChange: (value: string) => void;
  onUsdRateChange?: (value: string) => void;
  onDepositCurrencyChange?: (currency: string) => void;
}

export function BudgetCurrencyColumn({
  currency,
  form,
  fabricationDetails,
  materialsAll,
  poolsAll,
  readOnly,
  onTransportChange,
  onDepositAmountChange,
  onUsdRateChange,
  onDepositCurrencyChange,
}: BudgetCurrencyColumnProps) {
  const dd = Number(form.usd_rate);
  const isArs = currency === 'ARS';
  const transportKey = isArs ? 'transport' : 'transport_usd';
  const depositValue = isArs
    ? form.deposit_currency === 'USD' ? 0 : form.deposit_received
    : form.deposit_currency === 'USD' ? form.deposit_usd : 0;

  const totalValueClasses = `${s['budget-panel__total-value']} ${isArs ? s['budget-panel__total-value--ars'] : s['budget-panel__total-value--usd']}`;
  const balanceValueClasses = `${s['budget-panel__balance-value']} ${isArs ? s['budget-panel__balance-value--ars'] : s['budget-panel__balance-value--usd']}`;

  return (
    <div className={s['budget-panel__col']}>
      <div className={s['budget-panel__subtotal-header']}>
        SUBTOTALES ({currency})
      </div>
      <div className={s['budget-panel__subtotal-block']}>
        {fabricationDetails
          .filter((d) => Number(d.price) > 0)
          .map((d, i) => {
            const dd2 = Number(form.usd_rate);
            const precioArs =
              d.currency === 'ARS' ? Number(d.price)
                : dd2 > 0 ? Number(d.price) * dd2 : 0;
            const precioUsd =
              d.currency === 'USD' ? Number(d.price)
                : dd2 > 0 ? Number(d.price) / dd2 : 0;
            const price = isArs ? precioArs : precioUsd;
            return (
              <div key={i} className={s['lineItem']}>
                <span>
                  {d.concept === 'OTHER' ? d.detail || t('OTHER') : t(d.concept)}
                  {d.material ? ` - ${d.material}` : ''}
                  {d.m2 > 0 ? ` (${d.m2} m²)` : ''}
                  {d.length && d.length > 0 && d.concept === 'OTHER' ? ` (${d.length} m)` : ''}
                  {d.quantity > 1 ? ` x${d.quantity}` : ''}
                </span>
                <span className={s['lineItem__value']}>
                  {isArs
                    ? formatCurrency(price * d.quantity)
                    : <CurrencyDisplay value={price * d.quantity} currency="USD" />}
                </span>
              </div>
            );
          })}
        {materialsAll.map((m, i) => {
          const dd2 = Number(form.usd_rate);
          const m2 = Number(m.length || 0) * Number(m.width || 0) * (m.quantity || 1);
          const subArs =
            m.currency === 'ARS' ? m2 * (m.price_m2 || 0)
              : dd2 > 0 ? m2 * (m.price_m2_usd || 0) * dd2 : 0;
          const subUsd =
            m.currency === 'USD' ? m2 * (m.price_m2_usd || 0)
              : dd2 > 0 ? (m2 * (m.price_m2 || 0)) / dd2 : 0;
          const sub = isArs ? subArs : subUsd;
          return sub > 0 ? (
            <div key={`m${i}`} className={s['lineItem']}>
              <span>
                {m.name} ({m2.toFixed(3)} m²)
                {m.quantity > 1 ? ` x${m.quantity}` : ''}
              </span>
              <span className={s['lineItem__value']}>
                {isArs
                  ? formatCurrency(sub)
                  : <CurrencyDisplay value={sub} currency="USD" />}
              </span>
            </div>
          ) : null;
        })}
        {poolsAll.map((pt, i) => {
          const dd2 = Number(form.usd_rate);
          const precioArs =
            (pt.currency || 'ARS') === 'ARS' ? pt.price || 0
              : dd2 > 0 ? (pt.price || 0) * dd2 : 0;
          const precioUsd =
            (pt.currency || 'ARS') === 'USD' ? pt.price || 0
              : dd2 > 0 ? (pt.price || 0) / dd2 : 0;
          const price = isArs ? precioArs : precioUsd;
          return (
            <div key={`p${i}`} className={s['lineItem']}>
              <span>
                Pileta {pt.brand} - {pt.model}
                {pt.quantity > 1 ? ` (x${pt.quantity})` : ''}
              </span>
              <span className={s['lineItem__value']}>
                {isArs
                  ? formatCurrency(price * (pt.quantity || 1))
                  : <CurrencyDisplay value={price * (pt.quantity || 1)} currency="USD" />}
              </span>
            </div>
          );
        })}
      </div>

      <div className={`form-group ${s['budget-panel__field-row']}`}>
        <label className={s['budget-panel__field-row-label']}>Traslado ({currency})</label>
        <input
          type="number"
          className={`input ${s['budget-panel__field-row-input']}`}
          value={form[transportKey as keyof EntityFormState] as string ?? ''}
          onChange={(e) => onTransportChange(e.target.value, isArs ? 'ars' : 'usd')}
          disabled={readOnly}
        />
      </div>

      {isArs ? (
        <>
          <div className={s['budget-panel__total-block']}>
            <div className={s['budget-panel__total-row']}>
              <span className={s['budget-panel__total-label']}>TOTAL ARS</span>
              <span className={totalValueClasses}>
                {formatCurrency(form.total)}
              </span>
            </div>
          </div>

          <div className={`form-group ${s['budget-panel__field-row']}`}>
            <label className={s['budget-panel__field-row-label']}>Seña recibida (ARS)</label>
            <div className={s['budget-panel__deposit-currency']}>
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

          <div className={`form-group ${s['budget-panel__field-row']}`}>
            <label
              className={`${s['budget-panel__field-row-label']} ${s['budget-panel__field-row-label--strong']} ${s['budget-panel__usd-rate-label']}`}
            >
              DÓLAR DEL DÍA
            </label>
            <input
              type="number"
              className={`input ${s['budget-panel__field-row-input']} ${s['budget-panel__usd-rate-input']}`}
              value={form.usd_rate}
              onChange={(e) => onUsdRateChange?.(e.target.value)}
              disabled={readOnly}
            />
          </div>

          <div className={s['budget-panel__balance-row']}>
            <span className={s['budget-panel__balance-label']}>Saldo pendiente ARS</span>
            <span className={balanceValueClasses}>
              {formatCurrency(form.balance_due)}
            </span>
          </div>
        </>
      ) : (
        <>
          <div className={s['usdDivider']}>
            <div className={s['usdDivider__row']}>
              <span className={s['usdDivider__total']}>TOTAL USD</span>
              <span className={s['usdDivider__value']}>
                <CurrencyDisplay value={form.total_usd} currency="USD" />
              </span>
            </div>
          </div>

          <div className={`form-group ${s['budget-panel__field-row']}`}>
            <label className={s['budget-panel__field-row-label']}>Seña recibida (USD)</label>
            <div className={s['budget-panel__deposit-currency']}>
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

          <div className={s['balanceRow']}>
            <span className={s['balanceRow__label']}>Saldo pendiente USD</span>
            <span className={s['balanceRow__value']}>
              <CurrencyDisplay value={form.balance_due_usd} currency="USD" />
            </span>
          </div>
        </>
      )}
    </div>
  );
}
