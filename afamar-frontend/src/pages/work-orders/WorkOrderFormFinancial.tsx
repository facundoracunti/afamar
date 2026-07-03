import React from 'react';
import BudgetPanel from '../../components/budget/BudgetPanel';
import ApprovalSection from '../../components/orders/ApprovalSection';
import PoolCard from '../../components/materials/PoolCard';
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
      <div className="card">
        <h3 className="section-title">PILETAS</h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <select className="input" style={{ flex: 1, fontSize: 13 }} value="" onChange={(e) => { addPileta(e.target.value); e.target.value = ''; }} disabled={readOnly}>
            <option value="">+ AGREGAR PILETA</option>
            {piletas.map((p) => (
              <option key={p.id as number} value={p.id as number}>{p.brand as string} - {p.model as string} (Stock: {p.quantity as number})</option>
            ))}
          </select>
        </div>
        {(form.pools_data || []).map((pt, idx) => (
          <PoolCard
            key={idx}
            pt={pt as unknown as Record<string, unknown>}
            idx={idx}
            piletas={piletas}
            readOnly={readOnly}
            updatePileta={updatePileta}
            removePileta={removePileta}
            formPiletas={form.pools_data as unknown as Record<string, unknown>[]}
            update={update as (field: string, value: unknown) => void}
            num={num as (v: unknown) => number}
          />
        ))}
      </div>

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

      <ApprovalSection form={form} readOnly={readOnly} update={update as (field: string, value: unknown) => void} />
    </>
  );
}