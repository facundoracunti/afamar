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
}

export default function BudgetPanel({
  alternativasGrid,
  hidePaymentSection,
  sectionTitle = 'PRESUPUESTO',
  discountBlock,
}: BudgetPanelProps) {
  const { form, ui, financial, num, update, setForm, onConfirmarPago } = useBudgetPanel();
  const { hayAlternativas, readOnly, saving } = ui;

  const fabricationDetails: FabricationDetail[] = form.fabrication_details || [];
  const materialsAll = form.materials_data;
  const poolsAll = form.pools_data;
  const matsMain = hayAlternativas ? materialsAll.filter((m) => !m.is_alternative) : materialsAll;

  return (
    <div className="card">
      <div className={`section-title ${s['budget-panel__header']}`}>
        <span>{sectionTitle}</span>
      </div>

      <div>
        {!hayAlternativas && (
          <div className={s['budget-panel__columns']}>
            <BudgetCurrencyColumn
              currency="ARS"
              form={form}
              fabricationDetails={fabricationDetails}
              materialsAll={matsMain}
              poolsAll={poolsAll}
              readOnly={readOnly}
              onTransportChange={financial.handleTransportChange}
              onDepositAmountChange={financial.handleDepositAmountChange}
              onUsdRateChange={financial.handleUsdRateChange}
            />
            <BudgetCurrencyColumn
              currency="USD"
              form={form}
              fabricationDetails={fabricationDetails}
              materialsAll={matsMain}
              poolsAll={poolsAll}
              readOnly={readOnly}
              onTransportChange={financial.handleTransportChange}
              onDepositAmountChange={financial.handleDepositAmountChange}
            />
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
