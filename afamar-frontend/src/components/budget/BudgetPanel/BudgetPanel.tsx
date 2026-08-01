import React from 'react';
import type { FabricationDetail, MaterialInForm, PoolInForm } from '../../../types/budget';
import { BudgetCurrencyColumn } from './BudgetCurrencyColumn';
import { BudgetPaymentSection } from './BudgetPaymentSection';
import { useBudgetPanel } from './BudgetPanelContext';
import styles from './BudgetPanel.module.css';

const s = styles as unknown as Record<string, string>;

interface BudgetPanelProps {
  alternativasGrid?: React.ReactNode;
  hidePaymentSection?: boolean;
  sectionTitle?: string;
  discountBlock?: React.ReactNode;
  onUsdRateRefresh?: () => void;
}

export default function BudgetPanel({
  alternativasGrid,
  hidePaymentSection,
  sectionTitle = 'PRESUPUESTO',
  discountBlock,
  onUsdRateRefresh,
}: BudgetPanelProps) {
  const { form, ui, financial, num, update, setForm, onConfirmarPago } = useBudgetPanel();
  const { hayAlternativas, readOnly, saving } = ui;

  const fabricationDetails: FabricationDetail[] = form.fabrication_details || [];
  const materialsAll = form.materials_data;
  const poolsAll = form.pools_data;
  const matsMain = hayAlternativas ? materialsAll.filter((m) => !m.is_alternative) : materialsAll;

  return (
    <div className="card">
      <div className={s['budget-panel__header']}>
        <div className={`section-title ${s['budget-panel__title']}`}>
          <span>{sectionTitle}</span>
        </div>
        <div className={s['budget-panel__header-rate']}>
          <div className={s['budget-panel__header-rate-label']}>
            <span className={s['budget-panel__header-rate-title']}>DÓLAR DEL DÍA</span>
            <span className={s['budget-panel__header-rate-value']}>
              {Number(form.usd_rate || 0).toLocaleString('es-AR', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}
            </span>
            {!readOnly && onUsdRateRefresh && (
              <button
                type="button"
                className={s['budget-panel__header-rate-refresh']}
                onClick={onUsdRateRefresh}
                title="Actualizar dólar del día desde dolarapi.com"
                aria-label="Actualizar dólar del día"
              >
                ↻
              </button>
            )}
          </div>
          {form.usd_rate_fetched_at && (
            <span className={s['budget-panel__header-rate-updated']}>
              Actualizado: {new Date(form.usd_rate_fetched_at).toLocaleString('es-AR')}
            </span>
          )}
        </div>
      </div>

      <div>
        {!hayAlternativas && (
          <div className={s['budget-panel__columns']}>
            <BudgetCurrencyColumn
              currency="USD"
              form={form}
              fabricationDetails={fabricationDetails}
              materialsAll={matsMain}
              poolsAll={poolsAll}
              readOnly={readOnly}
              onTransportChange={financial.handleTransportChange}
              onDepositAmountChange={financial.handleDepositAmountChange}
              onUsdRateChange={financial.handleUsdRateChange}
              onUsdRateRefresh={onUsdRateRefresh}
            />
            <div className={s['budget-panel__col']}>
              <div className={s['budget-panel__usd-summary']}>
                <div className={s['budget-panel__usd-summary-row']}>
                  <div className={s['budget-panel__usd-summary-cell']}>
                    <div className={s['budget-panel__usd-summary-label']}>SUBTOTALES (ARS)</div>
                    <div className={s['budget-panel__usd-summary-value']}>
                      {materialsAll.reduce((acc, m) => {
                        const m2 = Number(m.length || 0) * Number(m.width || 0) * (m.quantity || 1);
                        const sub =
                          m.currency === 'ARS'
                            ? m2 * (m.price_m2 || 0)
                            : Number(form.usd_rate) > 0
                              ? (m2 * (m.price_m2_usd || 0)) * Number(form.usd_rate)
                              : 0;
                        return acc + sub;
                      }, 0)
                        .toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className={s['budget-panel__usd-summary-cell']}>
                    <div className={s['budget-panel__usd-summary-label']}>TOTAL ARS</div>
                    <div className={`${s['budget-panel__usd-summary-value']} ${s['budget-panel__balance-value--ars']}`}>
                      {Number(form.total || 0).toLocaleString('es-AR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                </div>
                <div className={s['budget-panel__usd-summary-row']}>
                  <div className={s['budget-panel__usd-summary-cell']}>
                    <div className={s['budget-panel__usd-summary-label']}>SALDO PENDIENTE ARS</div>
                    <div className={`${s['budget-panel__usd-summary-value']} ${s['budget-panel__balance-value--ars']}`}>
                      {Number(form.balance_due || 0).toLocaleString('es-AR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                  <div className={s['budget-panel__usd-summary-cell']}>
                    <div className={s['budget-panel__usd-summary-label']}>SEÑA RECIBIDA</div>
                    <div className={s['budget-panel__usd-summary-value']}>
                      <div className={s['budget-panel__usd-summary-deposit']}>
                        <select
                          className={`input ${s['budget-panel__currency-switch-select']}`}
                          value={form.deposit_currency || 'ARS'}
                          onChange={(e) => financial.handleDepositCurrencyChange(e.target.value)}
                          disabled={readOnly}
                          aria-label="Moneda de la seña"
                        >
                          <option value="ARS">ARS</option>
                          <option value="USD">USD</option>
                        </select>
                        <input
                          type="number"
                          className={`input ${s['budget-panel__deposit-input']}`}
                          value={
                            (form.deposit_currency || 'ARS') === 'ARS'
                              ? form.deposit_received
                              : form.deposit_usd
                          }
                          onChange={(e) => financial.handleDepositAmountChange(e.target.value)}
                          disabled={readOnly}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {alternativasGrid}
      </div>

      {!hidePaymentSection && (
        <BudgetPaymentSection
          form={form}
          readOnly={readOnly}
          saving={saving}
          update={update}
          setForm={setForm}
          num={num}
          handleDepositCurrencyChange={financial.handleDepositCurrencyChange}
          onConfirmarPago={onConfirmarPago}
          discountBlock={discountBlock}
        />
      )}
    </div>
  );
}
