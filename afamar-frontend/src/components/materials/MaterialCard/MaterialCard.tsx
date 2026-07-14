import React from 'react';
import type { MaterialInForm } from '../../../types/budget';
import { formatCurrencyValue } from '../../../utils/formatters';
import { CurrencyDisplay } from '../../../components/ui/CurrencyDisplay/CurrencyDisplay';
import styles from './MaterialCard.module.css';

const s = styles as unknown as Record<string, string>;

interface MaterialCardProps {
  mat: MaterialInForm;
  idx: number;
  readOnly: boolean;
  updateMaterial: (idx: number, field: string, value: unknown) => void;
  removeMaterial: (idx: number) => void;
  num: (v: unknown) => number;
  /** Current USD sell rate (peso → dollar). Used to show the dollar equivalent
   *  next to the native ARS price. Defaults to 0 = no conversion shown. */
  usdRate?: number;
}

export default function MaterialCard({
  mat, idx, readOnly, updateMaterial, removeMaterial, num, usdRate = 0,
}: MaterialCardProps) {
  const m2 = Number(mat.length || 0) * Number(mat.width || 0) * (mat.quantity || 1);
  const rawSubtotal = m2 * (mat.currency === 'USD' ? (mat.price_m2_usd || 0) : (mat.price_m2 || 0));
  const subtotal = Math.round(rawSubtotal * 100) / 100;
  const subtotalUsd =
    mat.currency === 'ARS' && usdRate > 0 ? Math.round((subtotal / usdRate) * 100) / 100 : null;

  const formatPrice = (n: number, currency: 'ARS' | 'USD'): string =>
    formatCurrencyValue(n, { currency });

  const formatSubtotal = (n: number, currency: 'ARS' | 'USD'): string =>
    formatCurrencyValue(n, { currency });

  return (
    <div className={s['material-card']}>
      <div className={s['material-card__header']}>
        <div className={s['material-card__title-group']}>
          <span className={s['material-card__title']}>{mat.name}</span>
          {mat.category && (
            <span className={s['material-card__category']}>{mat.category}</span>
          )}
        </div>
        <div className={s['material-card__actions']}>
          <label className={s['material-card__alt-label']}>
            <input
              type="checkbox"
              className={s['material-card__alt-checkbox']}
              checked={mat.is_alternative ?? false}
              onChange={(e) => updateMaterial(idx, 'is_alternative', e.target.checked)}
              disabled={readOnly}
            />
            <span>Alternativa</span>
          </label>
          <button
            type="button"
            className={s['material-card__remove']}
            onClick={() => removeMaterial(idx)}
            disabled={readOnly}
            aria-label="Eliminar material"
          >
            ✕
          </button>
        </div>
      </div>

      <div className={s['material-card__fields']}>
        <div className={s['material-card__field']}>
          <label className={s['material-card__label']}>Cant.</label>
          <input
            className={`input ${s['material-card__input']}`}
            type="number"
            min="1"
            value={mat.quantity || 1}
            onChange={(e) => updateMaterial(idx, 'quantity', num(e.target.value))}
            disabled={readOnly}
          />
        </div>
        <div className={s['material-card__field']}>
          <label className={s['material-card__label']}>Largo (mts)</label>
          <input
            className={`input ${s['material-card__input']}`}
            type="number"
            step="0.01"
            value={mat.length || ''}
            onChange={(e) => updateMaterial(idx, 'length', num(e.target.value))}
            disabled={readOnly}
          />
        </div>
        <div className={s['material-card__field']}>
          <label className={s['material-card__label']}>Ancho (mts)</label>
          <input
            className={`input ${s['material-card__input']}`}
            type="number"
            step="0.01"
            value={mat.width || ''}
            onChange={(e) => updateMaterial(idx, 'width', num(e.target.value))}
            disabled={readOnly}
          />
        </div>
        <div className={s['material-card__field']}>
          <label className={s['material-card__label']}>Precio M²</label>
          <div
            className={`${s['material-card__price']}${mat.currency === 'USD' ? ` ${s['material-card__price--usd']}` : ''}`}
          >
            {formatPrice(mat.currency === 'USD' ? (mat.price_m2_usd || 0) : (mat.price_m2 || 0), mat.currency)}
            {mat.currency === 'ARS' && usdRate > 0 && (
              <span className={s['material-card__price-usd']}>
                {' '}≈ <CurrencyDisplay value={mat.price_m2 / usdRate} currency="USD" />
              </span>
            )}
          </div>
        </div>
      </div>

      <div className={s['material-card__footer']}>
        <div className={s['material-card__m2']}>
          <span>
            Rendimiento:{' '}
            <strong className={s['material-card__m2-value']}>
              {m2.toFixed(3)} m²
            </strong>
          </span>
        </div>
        <div className={s['material-card__subtotal']}>
          Subtotal: {formatSubtotal(subtotal, mat.currency)}
          {subtotalUsd !== null && (
            <span className={s['material-card__subtotal-usd']}>
              {' '}≈ <CurrencyDisplay value={subtotalUsd} currency="USD" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

