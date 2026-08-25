/**
 * Create/edit form modal for a payment-method catalogue entry.
 *
 * Mirrors the AdditionalWorkForm pattern: parent owns the form state
 * and submit lifecycle, this component just renders the fields.
 */
import React from 'react';
import type { PaymentMethodType } from '../../../types/paymentMethod';
import styles from './PaymentMethodForm.module.css';

const s = styles as unknown as Record<string, string>;

const TYPE_LABELS: Record<PaymentMethodType, string> = {
  NONE: 'Sin cálculo (solo etiqueta)',
  DISCOUNT: 'Descuento',
  SURCHARGE: 'Recargo',
};

interface PaymentMethodFormData {
  name: string;
  label: string;
  type: PaymentMethodType;
  value: number;
  is_percentage: boolean;
  applies_to_installments: boolean;
  is_active: boolean;
  sort_order: number;
}

interface PaymentMethodFormProps {
  editItem: { id: number } | null;
  form: PaymentMethodFormData;
  saving: boolean;
  onChange: (f: React.SetStateAction<PaymentMethodFormData>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export function PaymentMethodForm({ editItem, form, saving, onChange, onSubmit, onCancel }: PaymentMethodFormProps) {
  const showValue = form.type !== 'NONE';

  return (
    <form onSubmit={onSubmit}>
      <div className={s['pm-form__row']}>
        <div className="form-group">
          <label>Identificador (name) *</label>
          <input
            className="input"
            required
            value={form.name}
            onChange={(e) => onChange((f) => ({ ...f, name: e.target.value }))}
            placeholder="Ej: TARJETA DE CRÉDITO"
            title="Identificador estable. Se guarda como snapshot en presupuestos y órdenes existentes; cambiarlo no rompe el histórico pero exige actualizar el form."
            disabled={!!editItem}
          />
        </div>
        <div className="form-group">
          <label>Etiqueta visible *</label>
          <input
            className="input"
            required
            autoFocus={!editItem}
            value={form.label}
            onChange={(e) => onChange((f) => ({ ...f, label: e.target.value }))}
            placeholder="Ej: Tarjeta de crédito"
          />
        </div>
      </div>

      <div className={s['pm-form__row']}>
        <div className="form-group">
          <label>Tipo</label>
          <select
            className="input"
            value={form.type}
            onChange={(e) => onChange((f) => ({ ...f, type: e.target.value as PaymentMethodType }))}
          >
            {(Object.keys(TYPE_LABELS) as PaymentMethodType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>
            {form.applies_to_installments && form.is_percentage
              ? 'Interés por cuota (%)'
              : 'Valor'}
            {showValue ? ' *' : ''}
          </label>
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            value={form.value || ''}
            onChange={(e) => onChange((f) => ({ ...f, value: Number(e.target.value) || 0 }))}
            disabled={!showValue}
            placeholder={showValue ? '0' : 'No aplica'}
            title={
              form.applies_to_installments && form.is_percentage
                ? 'Porcentaje de interés que se aplica por cada cuota sobre el total. N cuotas = N × este valor. Ej: 9 → 1 cuota: 9%, 2 cuotas: 18%, 3 cuotas: 27%. El total con recargo se divide en N cuotas iguales.'
                : showValue
                  ? 'Monto del descuento o recargo.'
                  : 'Sin cálculo automático — la etiqueta aparece en el PDF pero no modifica el total.'
            }
          />
        </div>
      </div>

      {showValue && (
        <div className={s['pm-form__row']}>
          <div className="form-group">
            <label className={s['pm-form__checkbox-label']}>
              <input
                type="checkbox"
                checked={form.is_percentage}
                onChange={(e) => onChange((f) => ({ ...f, is_percentage: e.target.checked }))}
              />
              {' '}Es porcentaje (%)
            </label>
            <small className={s['pm-form__hint']}>
              Si está activo, el valor se interpreta como porcentaje. Si no, se interpreta como monto fijo en ARS.
            </small>
          </div>
          <div className="form-group">
            <label className={s['pm-form__checkbox-label']}>
              <input
                type="checkbox"
                checked={form.applies_to_installments}
                onChange={(e) => onChange((f) => ({ ...f, applies_to_installments: e.target.checked }))}
              />
              {' '}Aplica por cuota (interés incremental)
            </label>
            <small className={s['pm-form__hint']}>
              Activalo para tarjetas / métodos con interés por cuota. N cuotas cargan <code>N × valor%</code> de recargo sobre el total (1=valor%, 2=2×valor%, 3=3×valor%…). El total con recargo se divide en N cuotas iguales. Se muestra el detalle en el Presupuesto y en el PDF.
            </small>
          </div>
        </div>
      )}

      <div className={s['pm-form__row']}>
        <div className="form-group">
          <label className={s['pm-form__checkbox-label']}>
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => onChange((f) => ({ ...f, is_active: e.target.checked }))}
            />
            {' '}Activo (aparece en el select del form)
          </label>
        </div>
        <div className="form-group">
          <label>Orden</label>
          <input
            className="input"
            type="number"
            step="1"
            value={form.sort_order}
            onChange={(e) => onChange((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))}
            title="Orden de aparición en el select. Menor = primero."
          />
        </div>
      </div>

      <div className={s['pm-form__actions']}>
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
