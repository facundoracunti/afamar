import React, { useState, useEffect } from 'react';
import type { EntityFormState } from '../../../types/form';
import type { PaymentMethod } from '../../../types/paymentMethod';
import { useBudgetPanel } from './BudgetPanelContext';
import { isCardPaymentMethod } from '../../../utils/creditCardAutoFill';
import { todayLocalISO } from '../../../hooks/entityFormHelpers';
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
  num,
  onConfirmarPago,
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
  const isCard = isCardPaymentMethod(currentMethod?.name);

  // Cuando el método es tarjeta (débito/crédito) NO hay seña: el total
  // completo (con el recargo de cuotas si es crédito) se cobra al momento
  // de la venta. Sincronizamos el deposit/balance con el total con recargo
  // y lo re-sincronizamos cada vez que cambia el total (ej. al cambiar la
  // cantidad de cuotas el interés sube el total) para que el "cobro 100%"
  // siga siempre el total final, incluido el interés.
  useEffect(() => {
    if (readOnly || !isCard) return;
    const totalArs = Number(form.total) || 0;
    const totalUsd = Number(form.total_usd) || 0;
    update('deposit_received', totalArs);
    update('deposit_usd', totalUsd);
    update('balance_due', 0);
    update('balance_due_usd', 0);
    update('balance_paid', true);
    update('balance_paid_at', todayLocalISO());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCard, readOnly, form.total, form.total_usd]);

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
        {isCard ? (
          <div className="form-group">
            <label>Pago total con tarjeta</label>
            <div className={s['budget-panel__usd-summary-deposit']}>
              <span className={`input ${s['budget-panel__deposit-input']} ${s['budget-panel__card-total-display']}`}>
                {depositValue ? `$ ${Number(depositValue).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$ 0,00'}
              </span>
            </div>
            <span className={s['budget-panel__card-total-hint']}>
              {showInstallments ? 'Incluye el interés de las cuotas' : 'No incluye interés'}
            </span>
          </div>
        ) : (
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
        )}
      </div>

      <div className="form-group">
        <label>Forma de pago</label>
        <div className={s['budget-panel__payment-method-controls']}>
          <select
            className={`input ${s['budget-panel__payment-method-select']}`}
            aria-label="Forma de pago"
            value={form.payment_method_id ?? form.payment_method ?? ''}
            onChange={(e) => {
              const raw = e.target.value;
              // "" → no method; "123" → FK id; "EFECTIVO" → legacy name match
              if (raw === '') {
                update('payment_method_id', null);
                update('payment_method', '');
                return;
              }
              let pm: PaymentMethod | undefined;
              const asNumber = Number(raw);
              if (!Number.isNaN(asNumber) && asNumber > 0 && paymentMethods.some((p) => p.id === asNumber)) {
                pm = paymentMethods.find((p) => p.id === asNumber);
                update('payment_method_id', pm!.id);
                update('payment_method', pm!.name);
              } else {
                pm = paymentMethods.find((p) => p.name === raw);
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

      {/* Per-order opt-in for the promotional discount configured on the
          selected payment method (e.g. "Efectivo — descuento 7%"). Only
          renders when the active method is a DISCOUNT; SURCHARGE and
          NONE methods ignore the flag. The form re-sends this boolean
          on every change so the server-side recalc gates the DISCOUNT
          branch accordingly. */}
      {currentMethod?.type === 'DISCOUNT' ? (
        <div className="form-group">
          <label
            className={s['budget-panel__cash-discount-toggle']}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <input
              type="checkbox"
              checked={!!form.apply_cash_discount}
              disabled={readOnly}
              onChange={(e) =>
                update('apply_cash_discount', e.target.checked)
              }
              aria-label="Aplicar descuento promocional por efectivo"
            />
            <span>
              Aplicar descuento promocional ({currentMethod.value}
              {currentMethod.is_percentage ? '%' : ''}) por
              {' '}
              {currentMethod.label}
            </span>
          </label>
        </div>
      ) : null}

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

      {isCard ? (
      <div
        className={`${s['paymentStatus']} ${s['paymentStatus--paid']}`}
      >
        <div className={s['paymentStatus__row']}>
          <div>
            <span className={s['paymentStatus__label']}>
              ✓ Pago cobrado (tarjeta)
            </span>
            {form.balance_paid_at && (
              <div className={s['paymentStatus__date']}>Fecha: {form.balance_paid_at}</div>
            )}
          </div>
        </div>
      </div>
      ) : (
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
      )}

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
