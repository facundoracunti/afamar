import React from 'react';
import BudgetPanel from '../../components/budget/BudgetPanel/BudgetPanel';
import type { EntityFormState } from '../../types';

interface WorkOrderFormFinancialProps {
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
  update: (field: string, value: unknown) => void;
  num: (v: string) => number | null;
  alternativasGrid: React.ReactNode | null;
  discountBlock: React.ReactNode | null;
  onConfirmarPago: () => Promise<void>;
  handleConfirmarPago: () => Promise<void>;
  mostrarToggleTitle: boolean;
  mostrarToggleColumns: boolean;
  sectionTitle?: string;
}

export default function WorkOrderFormFinancial({
  form,
  modoUSD,
  toggleModoUSD,
  hayUSD,
  hayAlternativas,
  readOnly,
  saving,
  handleTransportChange,
  handleDepositCurrencyChange,
  handleDepositAmountChange,
  handleUsdRateChange,
  setForm,
  update,
  num,
  alternativasGrid,
  discountBlock,
  handleConfirmarPago,
  mostrarToggleTitle,
  mostrarToggleColumns,
  sectionTitle = 'ORDEN DE TRABAJO',
}: WorkOrderFormFinancialProps) {
  return (
    <BudgetPanel
      form={form}
      modoUSD={modoUSD}
      toggleModoUSD={toggleModoUSD}
      hayUSD={hayUSD}
      hayAlternativas={hayAlternativas}
      readOnly={readOnly}
      saving={saving}
      handleTransportChange={handleTransportChange}
      handleDepositCurrencyChange={handleDepositCurrencyChange}
      handleDepositAmountChange={handleDepositAmountChange}
      handleUsdRateChange={handleUsdRateChange}
      setForm={setForm}
      update={update as (field: string, value: unknown) => void}
      num={num as (v: unknown) => number}
      hidePaymentSection={hayAlternativas}
      alternativasTop={null}
      alternativasGrid={alternativasGrid}
      discountBlock={discountBlock}
      onConfirmarPago={handleConfirmarPago}
      mostrarToggleTitle={mostrarToggleTitle}
      mostrarToggleColumns={mostrarToggleColumns}
      sectionTitle={sectionTitle}
    />
  );
}