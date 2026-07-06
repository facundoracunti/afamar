import React from 'react';
import BudgetPanel from '../../components/budget/BudgetPanel/BudgetPanel';
import type { EntityFormState } from '../../types';

interface BudgetFormFinancialProps {
  form: EntityFormState;
  modoUSD: boolean;
  toggleModoUSD: () => void;
  hayUSD: boolean;
  hayAlternativas: boolean;
  readOnly: boolean;
  saving: boolean;
  handleTransportChange: (value: string, source: 'ars' | 'usd') => void;
  handleDepositCurrencyChange: (moneda: string) => void;
  handleDepositAmountChange: (value: string) => void;
  handleUsdRateChange: (value: string) => void;
  setForm: React.Dispatch<React.SetStateAction<EntityFormState>>;
  update: (field: string, value: unknown) => void;
  num: (v: string) => number | null;
  alternativasTop: React.ReactNode | null;
  alternativasGrid: React.ReactNode | null;
  onConfirmarPago: () => Promise<void>;
}

export default function BudgetFormFinancial({
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
  alternativasTop,
  alternativasGrid,
  onConfirmarPago,
}: BudgetFormFinancialProps) {
  return (
    <>
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
        alternativasTop={alternativasTop}
        alternativasGrid={alternativasGrid}
        onConfirmarPago={onConfirmarPago}
      />
    </>
  );
}