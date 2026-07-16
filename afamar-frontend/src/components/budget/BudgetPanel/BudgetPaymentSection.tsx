import React from 'react';
import { formatCurrency } from '../../../utils/formatters';
import { CurrencyDisplay } from '../../ui/CurrencyDisplay/CurrencyDisplay';
import type { EntityFormState } from '../../../types/form';
import styles from './BudgetPanel.module.css';

const s = styles as unknown as Record<string, string>;

interface BudgetPaymentSectionProps {
  form: EntityFormState;
  readOnly: boolean;
  saving: boolean;
  update: (field: string, value: unknown) => void;
  setForm: React.Dispatch<React.SetStateAction<EntityFormState>>;
  num: (v: string) => number | null;
  handleDepositCurrencyChange: (currency: string) => void;
  onConfirmarPago?: () => Promise<void>;
  discountBlock?: React.ReactNode;
}

export function BudgetPaymentSection({
  form,
  readOnly,
  saving,
  update,
  setForm,
  num,
  handleDepositCurrencyChange,
  onConfirmarPago,
  discountBlock,
}: BudgetPaymentSectionProps) {
  return (
    <div className={s['subsectionHeader']}>
      <div
        className={`${s['paymentStatus']}${form.balance_paid ? ' ' + s['paymentStatus--paid'] : ' ' + s['paymentStatus--pending']}`}
      >
        <div className={s['paymentStatus__row']}>
          <div>
            <span className={s['paymentStatus__label']}>
              {form.balance_paid ? '✓ Saldo cobrado' : '⚠ Saldo pendiente de cobro'}
            </span>
            {form.balance_paid && form.balance_paid_at && (
              <div className={s['paymentStatus__date']}>Fecha: {form.balance_paid_at}</div>
            )}
          </div>
          <button
            type="button"
            onClick={onConfirmarPago}
            className={`${s['paymentStatus__button']}${form.balance_paid ? ' ' + s['paymentStatus__button--paid'] : ' ' + s['paymentStatus__button--pending']}`}
            disabled={saving}
          >
            {form.balance_paid ? 'Deshacer' : '✓ Confirmar pago'}
          </button>
        </div>
      </div>

      <div className={s['panelTotals']}>
        <div className={s['panelTotals__row']}>
          <div className={s['panelTotals__col']}>
            <div className={s['panelTotals__label']}>TOTAL ARS</div>
            <div className={`${s['panelTotals__value']} ${s['panelTotals__value--ars']}`}>
              {formatCurrency(form.total)}
            </div>
          </div>
          <div className={s['panelTotals__col']}>
            <div className={s['panelTotals__label']}>TOTAL USD</div>
            <div className={`${s['panelTotals__value']} ${s['panelTotals__value--usd']}`}>
              <CurrencyDisplay value={form.total_usd} currency="USD" />
            </div>
          </div>
        </div>
      </div>

      <div className={s['budget-panel__currency-switch']}>
        <label className={s['budget-panel__currency-switch-label']}>Seña</label>
        <select
          value={form.deposit_currency || 'ARS'}
          onChange={(e) => handleDepositCurrencyChange(e.target.value)}
          disabled={readOnly}
          className={`input ${s['budget-panel__currency-switch-select']}`}
        >
          <option value="ARS">ARS</option>
          <option value="USD">USD</option>
        </select>
      </div>

      {discountBlock}

      <div className={`form-group ${s['budget-panel__payment-method-row']}`}>
        <label>Forma de pago</label>
        <div className={s['budget-panel__payment-method-controls']}>
          <select
            className={`input ${s['budget-panel__payment-method-select']}`}
            value={form.payment_method}
            onChange={(e) => {
              const newVal = e.target.value;
              update('payment_method', newVal);
              if (newVal !== 'EFECTIVO') {
                setForm((prev) => ({
                  ...prev,
                  discount_percentage: 0,
                  discount_fixed_amount: 0,
                }));
              }
            }}
            disabled={readOnly}
          >
            <option value="">Seleccionar...</option>
            <option value="EFECTIVO">EFECTIVO</option>
            <option value="TRANSFERENCIA BANCARIA">TRANSFERENCIA BANCARIA</option>
            <option value="TARJETA DE DÉBITO">TARJETA DE DÉBITO</option>
            <option value="TARJETA DE CRÉDITO">TARJETA DE CRÉDITO</option>
          </select>
          {form.payment_method === 'TARJETA DE CRÉDITO' && (
            <select
              className={`input ${s['budget-panel__installments-select']}`}
              value={form.installments || 1}
              onChange={(e) =>
                update('installments', num(e.target.value) ?? 1)
              }
              disabled={readOnly}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((c) => {
                const pct = c <= 2 ? 0 : c * 5;
                return (
                  <option key={c} value={c}>
                    {c} cuota{c > 1 ? 's' : ''} ({pct}%)
                  </option>
                );
              })}
            </select>
          )}
        </div>
      </div>

      {form.payment_method === 'EFECTIVO' && (
        <div className={s['budget-panel__discount-box']}>
          <label className={s['budget-panel__discount-label']}>
            💰 Descuento Comercial (Solo Vendedor)
          </label>
          <div className={s['budget-panel__discount-row']}>
            <div className={s['budget-panel__discount-group']}>
              <span className={s['budget-panel__discount-symbol']}>%</span>
              <input
                type="number"
                className={`input ${s['budget-panel__discount-input']} ${s['budget-panel__discount-input--pct']}`}
                placeholder="0"
                min="0"
                max="100"
                value={form.discount_percentage || ''}
                onChange={(e) => {
                  const val = Number(e.target.value) || 0;
                  setForm({
                    ...form,
                    discount_percentage: val,
                    discount_fixed_amount: val > 0 ? 0 : form.discount_percentage,
                  });
                }}
                disabled={readOnly}
              />
            </div>
            <span className={s['budget-panel__discount-separator']}>o</span>
            <div className={s['budget-panel__discount-group']}>
              <span className={s['budget-panel__discount-symbol']}>$</span>
              <input
                type="number"
                className={`input ${s['budget-panel__discount-input']} ${s['budget-panel__discount-input--fixed']}`}
                placeholder="Monto fijo"
                value={form.discount_fixed_amount || ''}
                onChange={(e) => {
                  const val = Number(e.target.value) || 0;
                  setForm({
                    ...form,
                    discount_fixed_amount: val,
                    discount_percentage: val > 0 ? 0 : form.discount_percentage,
                  });
                }}
                disabled={readOnly}
              />
            </div>
          </div>
          <div className={s['budget-panel__discount-note']}>
            Este descuento modifica el TOTAL ARS final pero no se muestra en el PDF del cliente.
          </div>
        </div>
      )}

      <div className={`form-group ${s['budget-panel__delivery-row']}`}>
        <label>Fecha de entrega estimada</label>
        <input
          type="date"
          className="input"
          value={form.delivery_date || ''}
          onChange={(e) => update('delivery_date', e.target.value)}
          disabled={readOnly}
        />
      </div>
      <div className={`form-group ${s['budget-panel__delivery-row']}`}>
        <label>Fecha de aprobación</label>
        <input
          type="date"
          className="input"
          value={form.signed_at || ''}
          onChange={(e) => update('signed_at', e.target.value)}
          disabled={readOnly}
        />
      </div>
    </div>
  );
}
