/**
 * Create/edit form modal for an additional work catalogue item.
 */

import React from 'react';
import type { AdditionalWork, AdditionalWorkType } from '../../../types/additionalWork';
import styles from './AdditionalWorkForm.module.css';

const s = styles as unknown as Record<string, string>;

const TYPE_LABELS: Record<AdditionalWorkType, string> = {
  flat: 'Plano (cant. × precio)',
  frente: 'Frente / Regrueso (fórmula)',
};

interface AdditionalWorkFormData {
  name: string;
  detail: string;
  price: number;
  currency: 'ARS' | 'USD';
  type: AdditionalWorkType;
  formula_constant: number | null;
}

interface AdditionalWorkFormProps {
  editItem: AdditionalWork | null;
  form: AdditionalWorkFormData;
  saving: boolean;
  onChange: (f: React.SetStateAction<AdditionalWorkFormData>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export function AdditionalWorkForm({ editItem, form, saving, onChange, onSubmit, onCancel }: AdditionalWorkFormProps) {
  return (
    <form onSubmit={onSubmit}>
      <div className="form-group">
        <label>Nombre *</label>
        <input
          className="input"
          required
          autoFocus
          value={form.name}
          onChange={(e) => onChange((f) => ({ ...f, name: e.target.value }))}
          placeholder="Ej: Pulido de bordes, Frente / Regrueso, Traslado, etc."
        />
      </div>
      <div className="form-group">
        <label>Detalle</label>
        <textarea
          className="input"
          rows={2}
          value={form.detail}
          onChange={(e) => onChange((f) => ({ ...f, detail: e.target.value }))}
          placeholder="Descripción breve del trabajo adicional"
        />
      </div>
      <div className={s['aw-form__row']}>
        <div className="form-group">
          <label>Tipo</label>
          <select
            className="input"
            value={form.type}
            onChange={(e) => onChange((f) => ({ ...f, type: e.target.value as AdditionalWorkType }))}
          >
            <option value="flat">{TYPE_LABELS.flat}</option>
            <option value="frente">{TYPE_LABELS.frente}</option>
          </select>
        </div>
        <div className="form-group">
          <label>Moneda</label>
          <select
            className="input"
            value={form.currency}
            onChange={(e) => onChange((f) => ({ ...f, currency: e.target.value as 'ARS' | 'USD' }))}
          >
            <option value="ARS">ARS (Pesos)</option>
            <option value="USD">USD (Dólares)</option>
          </select>
        </div>
      </div>
      <div className={s['aw-form__row']}>
        <div className="form-group">
          <label>Precio{form.type === 'frente' ? ' (referencial)' : ''}</label>
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            value={form.price || ''}
            onChange={(e) => onChange((f) => ({ ...f, price: Number(e.target.value) || 0 }))}
            disabled={form.type === 'frente'}
            title={form.type === 'frente' ? 'Para Frente / Regrueso el precio se calcula automáticamente; este campo queda como referencial.' : undefined}
          />
        </div>
        <div className="form-group">
          <label>
            Multiplicador de fórmula
            {form.type === 'frente' ? ' *' : ''}
          </label>
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            value={form.formula_constant ?? ''}
            onChange={(e) =>
              onChange((f) => ({
                ...f,
                formula_constant: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
            disabled={form.type !== 'frente'}
            placeholder={form.type === 'frente' ? '1.15' : 'No aplica'}
            title={
              form.type === 'frente'
                ? 'Multiplicador que escala el 13% del precio por m² del material. Default 1.15.'
                : 'Solo aplica cuando el tipo es Frente / Regrueso.'
            }
          />
          {form.type === 'frente' ? (
            <small className={s['aw-form__formula-hint']}>
              Fórmula: (precio_m² × 0.13) × este multiplicador × los metros lineales del presupuesto.
            </small>
          ) : null}
        </div>
      </div>
      <div className={s['aw-form__actions']}>
        <button type="button" className="btn btn-outline" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {editItem ? 'Actualizar' : 'Crear'}
        </button>
      </div>
    </form>
  );
}
