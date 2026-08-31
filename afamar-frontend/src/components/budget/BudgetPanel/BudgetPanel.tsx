import React from 'react';
import type { FabricationDetail } from '../../../types/budget';
import { BudgetCurrencyColumn } from './BudgetCurrencyColumn';
import { BudgetLineItems } from './BudgetLineItems';
import { BudgetPaymentSection } from './BudgetPaymentSection';
import { useBudgetPanel } from './BudgetPanelContext';
import styles from './BudgetPanel.module.css';

const s = styles as unknown as Record<string, string>;

  interface BudgetPanelProps {
    alternativasGrid?: React.ReactNode;
    sectionTitle?: string;
    /** Slot renderizado debajo de Traslado/Se��a (ej: "CONVERTIR A ORDEN"). */
    actionBlock?: React.ReactNode;
  onUsdRateRefresh?: () => void;
}

  export default function BudgetPanel({
    alternativasGrid,
    sectionTitle = 'PRESUPUESTO',
    actionBlock,
    onUsdRateRefresh,
}: BudgetPanelProps) {
  const { form, ui, financial, num, update, setForm, onConfirmarPago } = useBudgetPanel();
  const { hayAlternativas, readOnly, saving } = ui;

  const fabricationDetails: FabricationDetail[] = form.fabrication_details || [];
  const materialsAll = form.materials_data;
  const poolsAll = form.pools_data;
  const matsMain = hayAlternativas ? materialsAll.filter((m) => !m.is_alternative) : materialsAll;

  return (
    <div className={s['budget-panel__wrapper']}>
      <div className={`card ${s['budget-panel__card']}`}>
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

        <div className={s['budget-panel__main']}>
          <div className={s['budget-panel__left-col']}>
            <BudgetLineItems
              form={form}
              fabricationDetails={fabricationDetails}
              materials={matsMain}
              pools={poolsAll}
            />
            <div className={s['budget-panel__columns']}>
              <BudgetCurrencyColumn currency="ARS" form={form} readOnly={readOnly} />
              <BudgetCurrencyColumn currency="USD" form={form} readOnly={readOnly} />
            </div>
          </div>

          {actionBlock && (
            <div className={s['budget-panel__action-block']}>{actionBlock}</div>
          )}

          <BudgetPaymentSection
            form={form}
            readOnly={readOnly}
            saving={saving}
            update={update}
              setForm={setForm}
              num={num}
              onConfirmarPago={onConfirmarPago}
            />
        </div>
      </div>

      {alternativasGrid}
    </div>
  );
}
