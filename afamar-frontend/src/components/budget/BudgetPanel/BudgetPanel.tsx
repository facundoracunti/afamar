import React from 'react';
import { formatCurrency } from '../../../utils/formatters';
import { t } from '../../../utils/translate';
import type { EntityFormState, FormField } from '../../../types/form';
import type { FabricationDetail, MaterialInForm, PoolInForm } from '../../../types/budget';
import styles from './BudgetPanel.module.css';

const s = styles as unknown as Record<string, string>;

type NumFn = (v: string) => number | null;
type UpdateFn = (field: FormField, value: unknown) => void;

interface BudgetPanelProps {
  form: EntityFormState;
  modoUSD: boolean;
  toggleModoUSD: () => void;
  hayUSD: boolean;
  hayAlternativas: boolean;
  readOnly: boolean;
  saving: boolean;
  handleTransportChange: (value: string, source: 'ars' | 'usd') => void;
  handleDepositCurrencyChange: (currency: string) => void;
  handleDepositAmountChange: (value: string) => void;
  handleUsdRateChange: (value: string) => void;
  setForm: React.Dispatch<React.SetStateAction<EntityFormState>>;
  update: UpdateFn;
  num: NumFn;
  hidePaymentSection: boolean;
  alternativasTop?: React.ReactNode;
  alternativasGrid?: React.ReactNode;
  discountBlock?: React.ReactNode;
  onConfirmarPago?: () => Promise<void>;
  sectionTitle?: string;
  mostrarToggleTitle?: boolean;
  mostrarToggleColumns?: boolean;
}

const toggleClasses = (active: boolean): string =>
  `${s['budget-panel__toggle']}${active ? ' ' + s['budget-panel__toggle--active'] : ''}`;

const totalValueClasses = (usd: boolean): string =>
  `${s['budget-panel__total-value']}${usd ? ' ' + s['budget-panel__total-value--usd'] : ' ' + s['budget-panel__total-value--ars']}`;

const balanceValueClasses = (usd: boolean): string =>
  `${s['budget-panel__balance-value']}${usd ? ' ' + s['budget-panel__balance-value--usd'] : ' ' + s['budget-panel__balance-value--ars']}`;

export default function BudgetPanel({
  form, modoUSD, toggleModoUSD, hayUSD, hayAlternativas,
  readOnly, saving, handleTransportChange, handleDepositCurrencyChange,
  handleDepositAmountChange, handleUsdRateChange, setForm, update, num,
  hidePaymentSection, alternativasTop, alternativasGrid, discountBlock,
  onConfirmarPago, sectionTitle = 'PRESUPUESTO',
  mostrarToggleTitle: _mostrarToggleTitle = false,
  mostrarToggleColumns: _mostrarToggleColumns = true,
}: BudgetPanelProps) {
  const dd = Number(form.usd_rate);
  // ARS and USD columns are always shown side by side. The legacy
  // `modoUSD` toggle (kept in props for backward-compat with the parent
  // form) is intentionally ignored — both currencies are always visible.
  const mostrarUSDCol = true;

  const fabricationDetails: FabricationDetail[] = form.fabrication_details || [];
  const materialsAll = (form.materials_data || []) as unknown as MaterialInForm[];
  const poolsAll = (form.pools_data || []) as unknown as PoolInForm[];
  const matsMain = hayAlternativas ? materialsAll.filter((m) => !m.is_alternative) : materialsAll;

  return (
    <div className="card">
      <div className={`section-title ${s['budget-panel__header']}`}>
        <span>{sectionTitle}</span>
      </div>

      <div>
        {!hayAlternativas && (
          <div className={s['budget-panel__columns']}>
            <div className={s['budget-panel__col']}>
              <div className={s['budget-panel__subtotal-header']}>
                SUBTOTALES (ARS)
              </div>
              <div className={s['budget-panel__subtotal-block']}>
                {fabricationDetails
                  .filter((d) => Number(d.price) > 0)
                  .map((d, i) => {
                    const dd2 = Number(form.usd_rate);
                    // Fabrication detail prices follow the row's own
                    // `currency` (legacy contract — the row's `price` is
                    // already in that currency). New rows default to ARS,
                    // legacy rows may still be USD.
                    const precioArs =
                      d.currency === 'ARS'
                        ? Number(d.price)
                        : dd2 > 0
                          ? Number(d.price) * dd2
                          : 0;
                    return (
                      <div key={i} className={s['lineItem']}>
                        <span>
                          {d.concept === 'OTHER'
                            ? d.detail || t('OTHER')
                            : t(d.concept)}
                          {d.material ? ` - ${d.material}` : ''}
                          {d.m2 > 0 ? ` (${d.m2} m²)` : ''}
                          {d.length && d.length > 0 && d.concept === 'OTHER'
                            ? ` (${d.length} m)`
                            : ''}
                          {d.quantity > 1 ? ` x${d.quantity}` : ''}
                        </span>
                        <span className={s['lineItem__value']}>
                          {formatCurrency(precioArs * d.quantity)}
                        </span>
                      </div>
                    );
                  })}
                {matsMain.map((m, i) => {
                  const dd2 = Number(form.usd_rate);
                  const m2 =
                    Number(m.length || 0) * Number(m.width || 0) * (m.quantity || 1);
                  const sub =
                    m.currency === 'ARS'
                      ? m2 * (m.price_m2 || 0)
                      : dd2 > 0
                        ? m2 * (m.price_m2_usd || 0) * dd2
                        : 0;
                  return sub > 0 ? (
                    <div key={`ma${i}`} className={s['lineItem']}>
                      <span>
                        {m.name} ({m2.toFixed(3)} m²)
                        {m.quantity > 1 ? ` x${m.quantity}` : ''}
                      </span>
                      <span className={s['lineItem__value']}>
                        {formatCurrency(sub)}
                      </span>
                    </div>
                  ) : null;
                })}
                {poolsAll.map((pt, i) => {
                  const dd2 = Number(form.usd_rate);
                  const precioArs =
                    (pt.currency || 'ARS') === 'ARS'
                      ? pt.price || 0
                      : dd2 > 0
                        ? (pt.price || 0) * dd2
                        : 0;
                  return (
                    <div key={`pa${i}`} className={s['lineItem']}>
                      <span>
                        Pileta {pt.brand} - {pt.model}
                        {pt.quantity > 1 ? ` (x${pt.quantity})` : ''}
                      </span>
                      <span className={s['lineItem__value']}>
                        {formatCurrency(precioArs * (pt.quantity || 1))}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className={`form-group ${s['budget-panel__field-row']}`}>
                <label className={s['budget-panel__field-row-label']}>Traslado (ARS)</label>
                <input
                  type="number"
                  className={`input ${s['budget-panel__field-row-input']}`}
                  value={form.transport}
                  onChange={(e) => handleTransportChange(e.target.value, 'ars')}
                  disabled={readOnly}
                />
              </div>

              <div className={s['budget-panel__total-block']}>
                <div className={s['budget-panel__total-row']}>
                  <span className={s['budget-panel__total-label']}>TOTAL ARS</span>
                  <span className={totalValueClasses(false)}>
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
                    value={form.deposit_currency === 'USD' ? 0 : form.deposit_received}
                    onChange={(e) => handleDepositAmountChange(e.target.value)}
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
                  onChange={(e) => handleUsdRateChange(e.target.value)}
                  disabled={readOnly}
                />
              </div>

              <div className={s['budget-panel__balance-row']}>
                <span className={s['budget-panel__balance-label']}>Saldo pendiente ARS</span>
                <span className={balanceValueClasses(false)}>
                  {formatCurrency(form.balance_due)}
                </span>
              </div>
            </div>

            <div className={s['budget-panel__col']}>
              <div className={s['budget-panel__subtotal-header']}>
                SUBTOTALES (USD)
              </div>
              <div className={s['budget-panel__subtotal-block']}>
                {fabricationDetails
                  .filter((d) => Number(d.price) > 0)
                  .map((d, i) => {
                    // Fabrication detail prices are always in ARS; the
                    // USD column is the ARS value divided by `usd_rate`.
                    const dd2 = Number(form.usd_rate);
                    const precioUsd = dd2 > 0 ? Number(d.price) / dd2 : 0;
                    return (
                      <div key={i} className={s['lineItem']}>
                        <span>
                          {d.concept === 'OTHER'
                            ? d.detail || t('OTHER')
                            : t(d.concept)}
                          {d.material ? ` - ${d.material}` : ''}
                          {d.m2 > 0 ? ` (${d.m2} m²)` : ''}
                          {d.quantity > 1 ? ` x${d.quantity}` : ''}
                        </span>
                        <span className={s['lineItem__value']}>
                          USD {(precioUsd * d.quantity).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    );
                  })}
                {matsMain.map((m, i) => {
                  const dd2 = Number(form.usd_rate);
                  const m2 =
                    Number(m.length || 0) * Number(m.width || 0) * (m.quantity || 1);
                  const sub =
                    m.currency === 'USD'
                      ? m2 * (m.price_m2_usd || 0)
                      : dd2 > 0
                        ? (m2 * (m.price_m2 || 0)) / dd2
                        : 0;
                  return sub > 0 ? (
                    <div key={`mu${i}`} className={s['lineItem']}>
                      <span>
                        {m.name} ({m2.toFixed(3)} m²)
                        {m.quantity > 1 ? ` x${m.quantity}` : ''}
                      </span>
                      <span className={s['lineItem__value']}>
                        USD {sub.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ) : null;
                })}
                {poolsAll.map((pt, i) => {
                  const dd2 = Number(form.usd_rate);
                  const precioUsd =
                    (pt.currency || 'ARS') === 'USD'
                      ? pt.price || 0
                      : dd2 > 0
                        ? (pt.price || 0) / dd2
                        : 0;
                  return (
                    <div key={`pu${i}`} className={s['lineItem']}>
                      <span>
                        Pileta {pt.brand} - {pt.model}
                        {pt.quantity > 1 ? ` (x${pt.quantity})` : ''}
                      </span>
                      <span className={s['lineItem__value']}>
                        USD {(precioUsd * (pt.quantity || 1)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className={`form-group ${s['budget-panel__field-row']}`}>
                <label className={s['budget-panel__field-row-label']}>Traslado (USD)</label>
                <input
                  type="number"
                  className={`input ${s['budget-panel__field-row-input']}`}
                  value={form.transport_usd}
                  onChange={(e) => handleTransportChange(e.target.value, 'usd')}
                  disabled={readOnly}
                />
              </div>

              <div className={s['usdDivider']}>
                <div className={s['usdDivider__row']}>
                  <span className={s['usdDivider__total']}>TOTAL USD</span>
                  <span className={s['usdDivider__value']}>
                    USD {form.total_usd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className={`form-group ${s['budget-panel__field-row']}`}>
                <label className={s['budget-panel__field-row-label']}>Seña recibida (USD)</label>
                <div className={s['budget-panel__deposit-currency']}>
                  <input
                    type="number"
                    className={`input ${s['budget-panel__deposit-input']}`}
                    value={form.deposit_currency === 'USD' ? form.deposit_usd : 0}
                    onChange={(e) => handleDepositAmountChange(e.target.value)}
                    disabled={readOnly}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className={s['balanceRow']}>
                <span className={s['balanceRow__label']}>Saldo pendiente USD</span>
                <span className={s['balanceRow__value']}>
                  USD {form.balance_due_usd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        )}

        {alternativasGrid}
      </div>

      {!hidePaymentSection && (
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
                  USD {form.total_usd.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
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
      )}
    </div>
  );
}