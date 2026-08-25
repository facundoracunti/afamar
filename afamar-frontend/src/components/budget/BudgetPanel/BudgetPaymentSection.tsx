import React, { useState } from 'react';
import type { EntityFormState } from '../../../types/form';
import type { PaymentMethod } from '../../../types/paymentMethod';
import { useBudgetPanel } from './BudgetPanelContext';
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

/** Human-readable label for the catalogue's `type` column. */
function describeMethod(pm: PaymentMethod): string {
  if (pm.type === 'NONE' || !pm.value) return pm.label;
  const verb = pm.type === 'DISCOUNT' ? 'descuento' : 'recargo';
  const amount = pm.is_percentage ? `${pm.value}%` : `$${pm.value}`;
  const suffix = pm.applies_to_installments ? ' por cuota' : '';
  return `${pm.label} — ${verb} ${amount}${suffix}`;
}

/** Find the catalogue row that matches the form's current snapshot.
 *  Prefers `payment_method_id` (FK), falls back to `payment_method`
 *  (name) for budgets/OTs that predate the FK. */
function resolveCurrentMethod(
  form: EntityFormState,
  catalogue: PaymentMethod[],
): PaymentMethod | null {
  if (form.payment_method_id) {
    const byId = catalogue.find((pm) => pm.id === form.payment_method_id);
    if (byId) return byId;
  }
  if (form.payment_method) {
    const byName = catalogue.find((pm) => pm.name === form.payment_method);
    if (byName) return byName;
  }
  return null;
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
  const { financial, paymentMethods: rawPaymentMethods } = useBudgetPanel();
  const paymentMethods = rawPaymentMethods ?? [];
  const { handleTransportChange, handleDepositCurrencyChange, handleDepositAmountChange } = financial;
  const [transportCurrency, setTransportCurrency] = useState<'ARS' | 'USD'>('ARS');

  const transportValue = transportCurrency === 'ARS'
    ? (Number(form.transport) > 0 ? String(form.transport) : '')
    : (Number(form.transport_usd) > 0 ? String(form.transport_usd) : '');
  const depositValue = (form.deposit_currency || 'ARS') === 'ARS'
    ? (Number(form.deposit_received) > 0 ? String(form.deposit_received) : '')
    : (Number(form.deposit_usd) > 0 ? String(form.deposit_usd) : '');

  const currentMethod = resolveCurrentMethod(form, paymentMethods);
  const showInstallments = !!currentMethod?.applies_to_installments;

  return (
    <div className={s['budget-panel__payment-col']}>
      {/* Traslado + Seña recibida — encima del botón Confirmar pago */}
      <div className={s['budget-panel__payment-transport']}>
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
              onChange={(e) => handleTransportChange(e.target.value, transportCurrency === 'ARS' ? 'ars' : 'usd')}
              disabled={readOnly}
              placeholder="0"
            />
          </div>
        </div>
        <div className="form-group">
          <label>Seña recibida</label>
          <div className={s['budget-panel__usd-summary-deposit']}>
            <select
              className={`input ${s['budget-panel__currency-switch-select']}`}
              value={form.deposit_currency || 'ARS'}
              onChange={(e) => handleDepositCurrencyChange(e.target.value)}
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
              onChange={(e) => handleDepositAmountChange(e.target.value)}
              disabled={readOnly}
              placeholder="0"
            />
          </div>
        </div>
      </div>

      <div className="form-group">
        <label>Forma de pago</label>
        <div className={s['budget-panel__payment-method-controls']}>
          <select
            className={`input ${s['budget-panel__payment-method-select']}`}
            value={form.payment_method_id ?? form.payment_method ?? ''}
            onChange={(e) => {
              const raw = e.target.value;
              // "" → no method; "123" → FK id; "EFECTIVO" → legacy name match
              if (raw === '') {
                update('payment_method_id', null);
                update('payment_method', '');
                return;
              }
              const asNumber = Number(raw);
              if (!Number.isNaN(asNumber) && asNumber > 0 && paymentMethods.some((pm) => pm.id === asNumber)) {
                const pm = paymentMethods.find((p) => p.id === asNumber)!;
                update('payment_method_id', pm.id);
                update('payment_method', pm.name);
              } else {
                const pm = paymentMethods.find((p) => p.name === raw);
                update('payment_method_id', pm?.id ?? null);
                update('payment_method', raw);
              }
            }}
            disabled={readOnly}
          >
            <option value="">Seleccionar...</option>
            {paymentMethods.map((pm) => (
              <option key={pm.id} value={pm.id}>
                {describeMethod(pm)}
              </option>
            ))}
          </select>
          {showInstallments && (
            <select
              className={`input ${s['budget-panel__installments-select']}`}
              value={form.installments || 1}
              onChange={(e) =>
                update('installments', num(e.target.value) ?? 1)
              }
              disabled={readOnly}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((c) => {
                // Credit-card rule: N × value% de recargo sobre el total
                // (1=9%, 2=18%, 3=27%, …). El total con recargo se
                // divide en N cuotas iguales. Coincide con el cálculo
                // del hook + el PDF.
                const pct = c * (currentMethod?.value ?? 0);
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

      {showInstallments && form.installment_detail_ars && form.installment_detail_ars.length > 1 ? (
        <div
          className={s['budget-panel__installment-table']}
          aria-label="Detalle de cuotas"
        >
          <div className={s['budget-panel__installment-table-header']}>
            <span>Cuota #</span>
            <span>Interés</span>
            <span>Monto</span>
          </div>
          {form.installment_detail_ars.map((row) => (
            <div
              key={row.cuota}
              className={s['budget-panel__installment-table-row']}
            >
              <span>{row.cuota}</span>
              <span>{`${row.interes}%`}</span>
              <span>{`$ ${row.monto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</span>
            </div>
          ))}
        </div>
      ) : null}

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
