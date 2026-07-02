import React from 'react';
import PresupuestoPanel from '../../components/presupuesto/PresupuestoPanel';
import AprobacionSection from '../../components/ordenes/AprobacionSection';
import type { EntityFormState } from '../../types';

interface BudgetFormFinancialProps {
  form: EntityFormState;
  modoUSD: boolean;
  toggleModoUSD: () => void;
  hayUSD: boolean;
  hayAlternativas: boolean;
  readOnly: boolean;
  saving: boolean;
  handleTrasladoChange: (value: string, source: 'ars' | 'usd') => void;
  handleSenaMonedaChange: (moneda: string) => void;
  handleSenaMontoChange: (value: string) => void;
  handleDolarDiaChange: (value: string) => void;
  setForm: React.Dispatch<React.SetStateAction<EntityFormState>>;
  update: (field: string, value: unknown) => void;
  num: (v: string) => number | null;
  alternativasTop: React.ReactNode | null;
  alternativasGrid: React.ReactNode | null;
  descuentoBlock: React.ReactNode | null;
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
  handleTrasladoChange,
  handleSenaMonedaChange,
  handleSenaMontoChange,
  handleDolarDiaChange,
  setForm,
  update,
  num,
  alternativasTop,
  alternativasGrid,
  descuentoBlock,
  onConfirmarPago,
}: BudgetFormFinancialProps) {
  return (
    <>
      <PresupuestoPanel
        form={form}
        modoUSD={modoUSD}
        toggleModoUSD={toggleModoUSD}
        hayUSD={hayUSD}
        hayAlternativas={hayAlternativas}
        readOnly={readOnly}
        saving={saving}
        handleTrasladoChange={handleTrasladoChange}
        handleSenaMonedaChange={handleSenaMonedaChange}
        handleSenaMontoChange={handleSenaMontoChange}
        handleDolarDiaChange={handleDolarDiaChange}
        setForm={setForm}
        update={update as (field: string, value: unknown) => void}
        num={num as (v: unknown) => number}
        hidePaymentSection={hayAlternativas}
        alternativasTop={alternativasTop}
        alternativasGrid={alternativasGrid}
        descuentoBlock={descuentoBlock}
        onConfirmarPago={onConfirmarPago}
      />
      <AprobacionSection form={form} readOnly={readOnly} update={update as (field: string, value: unknown) => void} />
    </>
  );
}