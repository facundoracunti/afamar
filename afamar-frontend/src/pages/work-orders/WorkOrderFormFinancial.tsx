import React from 'react';
import PresupuestoPanel from '../../components/presupuesto/PresupuestoPanel';
import AprobacionSection from '../../components/ordenes/AprobacionSection';
import PiletaCard from '../../components/materiales/PiletaCard';
import type { EntityFormState } from '../../types';

interface WorkOrderFormFinancialProps {
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
  handleTrasladoChange,
  handleSenaMonedaChange,
  handleSenaMontoChange,
  handleDolarDiaChange,
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
              <option key={p.id as number} value={p.id as number}>{p.marca as string} - {p.modelo as string} (Stock: {p.cantidad as number})</option>
            ))}
          </select>
        </div>
        {(form.piletas || []).map((pt, idx) => (
          <PiletaCard
            key={idx}
            pt={pt as unknown as Record<string, unknown>}
            idx={idx}
            piletas={piletas}
            readOnly={readOnly}
            updatePileta={updatePileta}
            removePileta={removePileta}
            formPiletas={form.piletas as unknown as Record<string, unknown>[]}
            update={update as (field: string, value: unknown) => void}
            num={num as (v: unknown) => number}
          />
        ))}
      </div>

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
        alternativasTop={null}
        alternativasGrid={alternativasGrid}
        descuentoBlock={descuentoBlock}
        onConfirmarPago={handleConfirmarPago}
        mostrarToggleTitle={mostrarToggleTitle}
        mostrarToggleColumns={mostrarToggleColumns}
      />

      <AprobacionSection form={form} readOnly={readOnly} update={update as (field: string, value: unknown) => void} />
    </>
  );
}