import React from 'react';
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
  onConfirmarPago,
  discountBlock,
}: BudgetPaymentSectionProps) {
  return (
    <div className={s['budget-panel__payment-col']}>
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

      <div className="form-group">
        <label>Forma de pago</label>
        <div className={s['budget-panel__payment-method-controls']}>
          <select
            className={`input ${s['budget-panel__payment-method-select']}`}
            value={form.payment_method ?? ''}
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

      {discountBlock}

      <div className={s['budget-panel__dates']}>
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
    </div>
  );
}
