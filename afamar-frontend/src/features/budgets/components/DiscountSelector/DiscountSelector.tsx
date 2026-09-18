/**
 * Fase 3 — Descuento Comercial selector (frontend-only, budgets).
 *
 * Toggle + % + base. Textos siempre en español (UI).
 * Los textos visibles (“Aplicar descuento”, “Total General”,
 * “Solo Materiales”, “Base”, “Descuento”, “Total con descuento”)
 * son los que ve el operador; los identificadores internos van en inglés.
 */

import type { EntityFormState, FormField } from '@/types/form';
import { useCommercialDiscount } from '../../hooks/useCommercialDiscount';
import { DISCOUNT_TARGET_LABELS, type DiscountTarget } from '../../types/discount';
import styles from './DiscountSelector.module.css';

const s = styles as unknown as Record<string, string>;

const ars = (v: number): string =>
  Number(v || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const usd = (v: number): string =>
  Number(v || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

interface DiscountSelectorProps {
  form: EntityFormState;
  readOnly: boolean;
  update: (field: FormField, value: unknown) => void;
}

export default function DiscountSelector({
  form,
  readOnly,
  update,
}: DiscountSelectorProps) {
  const discount = useCommercialDiscount(form, update);

  return (
    <div className={`card ${s['discount-selector']}`}>
      <div className={s['discount-selector__header']}>
        <span className={`section-title ${s['discount-selector__title']}`}>
          Descuento Comercial
        </span>
        <label className={s['discount-selector__toggle']}>
          <input
            type="checkbox"
            checked={discount.enabled}
            disabled={readOnly}
            onChange={(e) => discount.setEnabled(e.target.checked)}
            aria-label="Aplicar descuento comercial"
          />
          <span>Aplicar descuento</span>
        </label>
      </div>

      {discount.enabled && (
        <div className={s['discount-selector__body']}>
          <div className={s['discount-selector__row']}>
            <div className={s['discount-selector__field']}>
              <label htmlFor="discount-percentage">Descuento (%)</label>
              <input
                id="discount-percentage"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={discount.percentage || ''}
                onChange={(e) => discount.setPercentage(e.target.value)}
                disabled={readOnly}
                placeholder="0"
              />
            </div>
            <div className={s['discount-selector__field']}>
              <label htmlFor="discount-target">Sobre</label>
              <select
                id="discount-target"
                value={discount.target}
                onChange={(e) => discount.setTarget(e.target.value as DiscountTarget)}
                disabled={readOnly}
              >
                {(Object.keys(DISCOUNT_TARGET_LABELS) as DiscountTarget[]).map(
                  (t) => (
                    <option key={t} value={t}>
                      {DISCOUNT_TARGET_LABELS[t]}
                    </option>
                  ),
                )}
              </select>
            </div>
          </div>

          <div className={s['discount-selector__summary']}>
            <div className={s['discount-selector__summary-row']}>
              <span>Base ({DISCOUNT_TARGET_LABELS[discount.target]})</span>
              <span>$ {ars(discount.baseArs)}</span>
            </div>
            <div
              className={`${s['discount-selector__summary-row']} ${s['discount-selector__summary-discount']}`}
            >
              <span>Descuento ({discount.percentage}%)</span>
              <span>- $ {ars(discount.discountAmountArs)}</span>
            </div>
            <div className={`${s['discount-selector__summary-row']} ${s['discount-selector__summary-total']}`}>
              <span>Total con descuento</span>
              <span>$ {ars(discount.totalAfterArs)}</span>
            </div>
            <div className={`${s['discount-selector__summary-row']} ${s['discount-selector__summary-usd']}`}>
              <span>Descuento (USD)</span>
              <span>- USD {usd(discount.discountAmountUsd)}</span>
            </div>
            <div className={`${s['discount-selector__summary-row']} ${s['discount-selector__summary-total']} ${s['discount-selector__summary-usd']}`}>
              <span>Total con descuento (USD)</span>
              <span>USD {usd(discount.totalAfterUsd)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}