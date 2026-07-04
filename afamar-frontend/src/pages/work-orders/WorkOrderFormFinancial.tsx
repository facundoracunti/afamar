import React from 'react';
import BudgetPanel from '../../components/features/budget/BudgetPanel';
import PoolSection from '../../components/features/materials/PoolSection';
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
  handleDepositCurrencyChange: (moneda: string) => void;
  handleDepositAmountChange: (value: string) => void;
  handleUsdRateChange: (value: string) => void;
  setForm: React.Dispatch<React.SetStateAction<EntityFormState>>;
  update: (field: string, value: unknown) => void;
  num: (v: string) => number | null;
  piletas: Record<string, unknown>[];
  addPileta: (id: string) => void;
  updatePileta: (idx: number, field: string, value: unknown) => void;
  removePileta: (idx: number) => void;
  alternativasGrid: React.ReactNode | null;
  descuentoBlock: React.ReactNode | null;
  onConfirmarPago: () => Promise<void>;
  handleConfirmarPago: () => Promise<void>;
  mostrarToggleTitle: boolean;
  mostrarToggleColumns: boolean;
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
  piletas,
  addPileta,
  updatePileta,
  removePileta,
  alternativasGrid,
  descuentoBlock,
  onConfirmarPago,
  handleConfirmarPago,
  mostrarToggleTitle,
  mostrarToggleColumns,
}: WorkOrderFormFinancialProps) {
  return (
    <>
      <PoolSection
        piletas={piletas}
        formPiletas={form.pools_data as unknown as Record<string, unknown>[]}
        readOnly={readOnly}
        addPileta={addPileta}
        updatePileta={updatePileta}
        removePileta={removePileta}
        update={update as (field: string, value: unknown) => void}
        num={num as (v: unknown) => number}
      />

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
        descuentoBlock={descuentoBlock}
        onConfirmarPago={handleConfirmarPago}
        mostrarToggleTitle={mostrarToggleTitle}
        mostrarToggleColumns={mostrarToggleColumns}
      />
    </>
  );
}