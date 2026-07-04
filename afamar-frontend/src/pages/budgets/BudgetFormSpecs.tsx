import React from 'react';
import MaterialCard from '../../components/features/materials/MaterialCard';
import type { EntityFormState } from '../../types';

interface BudgetFormSpecsProps {
  form: EntityFormState;
  readOnly: boolean;
  materiales: Record<string, unknown>[];
  addMaterial: (name: string) => void;
  updateMaterial: (idx: number, field: string, value: unknown) => void;
  removeMaterial: (idx: number) => void;
  update: (field: string, value: unknown) => void;
  num: (v: string) => number | null;
}

export default function BudgetFormSpecs({
  form,
  readOnly,
  materiales,
  addMaterial,
  updateMaterial,
  removeMaterial,
  update,
  num,
}: BudgetFormSpecsProps) {
  return (
    <div className="card" style={{ height: '100%' }}>
      <h3 className="section-title">MATERIALES</h3>
      <div className="form-group">
        <select className="input" value="" onChange={(e) => { addMaterial(e.target.value); e.target.value = ''; }} disabled={readOnly}>
          <option value="">+ AGREGAR MATERIAL</option>
          {materiales.filter((m: Record<string, unknown>) => m.name).map((m: Record<string, unknown>) => (
            <option key={m.id as number} value={m.name as string}>
              {m.name as string}{m.color ? ` - ${m.color as string}` : ''}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'grid', gap: 12 }}>
        {(form.materials_data || []).map((mat, idx) => (
          <MaterialCard
            key={idx}
            mat={mat as unknown as Record<string, unknown>}
            idx={idx}
            readOnly={readOnly}
            updateMaterial={updateMaterial}
            removeMaterial={removeMaterial}
            num={num}
          />
        ))}
      </div>
      {(form.materials_data || []).length === 0 && (
        <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8' }}>
          Sin materiales agregados. Usá "+ AGREGAR MATERIAL" para sumar.
        </div>
      )}
      <div className="form-group">
        <label>Observaciones del diseño</label>
        <textarea
          className="input"
          rows={4}
          value={form.design_observations}
          onChange={(e) => update('design_observations', e.target.value)}
          placeholder="Zócalo de 7 cm. Frente de 4 cm. Incluye 3 perforaciones..."
          disabled={readOnly}
        />
      </div>
    </div>
  );
}