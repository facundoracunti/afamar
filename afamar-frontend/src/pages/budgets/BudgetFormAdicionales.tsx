import React from 'react';
import PoolCard from '../../components/materials/PoolCard';
import type { EntityFormState } from '../../types';

interface BudgetFormAdicionalesProps {
  form: EntityFormState;
  readOnly: boolean;
  piletas: Record<string, unknown>[];
  update: (field: string, value: unknown) => void;
  updatePileta: (idx: number, field: string, value: unknown) => void;
  removePileta: (idx: number) => void;
  addPileta: (id: string) => void;
  num: (v: string) => number | null;
}

export default function BudgetFormAdicionales({
  form,
  readOnly,
  piletas,
  update,
  updatePileta,
  removePileta,
  addPileta,
  num,
}: BudgetFormAdicionalesProps) {
  return (
    <div className="card">
      <h3 className="section-title">PILETAS</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <select
          className="input"
          style={{ flex: 1, fontSize: 13 }}
          value=""
          onChange={(e) => { addPileta(e.target.value); e.target.value = ''; }}
          disabled={readOnly}
        >
          <option value="">+ AGREGAR PILETA</option>
          {piletas.map((p) => (
            <option key={p.id as number} value={p.id as number}>
              {p.marca as string} - {p.modelo as string} (Stock: {p.cantidad as number})
            </option>
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
  );
}