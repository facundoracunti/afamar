import React, { useState } from 'react';
import type { MaterialInForm } from '../../../types/budget';
import type { Material } from '../../../types/material';
import type { MaterialCategory } from '../../../api/resources/materials';
import { formatCurrencyValue } from '../../../utils/formatters';
import { CurrencyDisplay } from '../../../components/ui/CurrencyDisplay/CurrencyDisplay';
import MaterialPickerControls from '../MaterialPickerControls/MaterialPickerControls';
import styles from './MaterialCard.module.css';

const s = styles as unknown as Record<string, string>;

interface MaterialRow {
  mat: MaterialInForm;
  /** Global index of this row inside `materials_data`. */
  idx: number;
}

interface MaterialCardProps {
  /** Rows grouped by material (one card per physical material). */
  rows: MaterialRow[];
  readOnly: boolean;
  /** Reference materials + categories for the "Cambiar material" picker. */
  materials: Material[];
  categorias: MaterialCategory[];
  updateMaterial: (idx: number, field: string, value: unknown) => void;
  /** Apply `field` to every row of the card in a single state update. */
  updateMaterialGroup: (idxs: number[], field: string, value: unknown) => void;
  removeMaterial: (idx: number) => void;
  /** Remove the whole card (all its rows). */
  removeGroup: (idxs: number[]) => void;
  /** Add another measurement row of this material. */
  addRow: (mat: MaterialInForm) => void;
  /** Replace this card's catalogue identity (name/color/prices/currency),
   *  keeping the measurements already entered. */
  onChangeMaterial: (mat: Material) => void;
  num: (v: unknown) => number;
  /** Current USD sell rate (peso → dollar). Used to show the dollar equivalent
   *  next to the native ARS price. Defaults to 0 = no conversion shown. */
  usdRate?: number;
}

function rowM2(mat: MaterialInForm): number {
  return Number(mat.length || 0) * Number(mat.width || 0) * Number(mat.quantity || 1);
}

function rowSubtotal(mat: MaterialInForm): number {
  const price = mat.currency === 'USD' ? mat.price_m2_usd || 0 : mat.price_m2 || 0;
  return Math.round(rowM2(mat) * price * 100) / 100;
}

function MaterialCardInner({
  rows, readOnly, materials, categorias, updateMaterial, updateMaterialGroup, removeMaterial, removeGroup, addRow, onChangeMaterial, num, usdRate = 0,
}: MaterialCardProps) {
  const head = rows[0]?.mat;
  const [pickerOpen, setPickerOpen] = useState(false);
  if (!head) return null;

  const currency: 'ARS' | 'USD' = head.currency === 'USD' ? 'USD' : 'ARS';
  const price = currency === 'USD' ? head.price_m2_usd || 0 : head.price_m2 || 0;
  const indices = rows.map((r) => r.idx);
  const anyAlt = rows.some((r) => r.mat.is_alternative);
  const totalM2 = rows.reduce((acc, r) => acc + rowM2(r.mat), 0);
  const totalSubtotal = Math.round(rows.reduce((acc, r) => acc + rowSubtotal(r.mat), 0) * 100) / 100;
  const totalSubtotalUsd = currency === 'ARS' && usdRate > 0 ? Math.round((totalSubtotal / usdRate) * 100) / 100 : null;

  const formatPrice = (n: number, c: 'ARS' | 'USD'): string =>
    formatCurrencyValue(n, { currency: c });

  return (
    <div className={s['material-card']} data-testid="material-card">
      <div className={s['material-card__header']}>
        <div className={s['material-card__title-group']}>
          <span className={s['material-card__title']}>{head.name}</span>
          {head.category && (
            <span className={s['material-card__category']}>{head.category}</span>
          )}
        </div>
        <div className={s['material-card__price-block']}>
          <span
            className={`${s['material-card__price']}${currency === 'USD' ? ` ${s['material-card__price--usd']}` : ''}`}
          >
            {formatPrice(price, currency)}
          </span>
          {currency === 'ARS' && usdRate > 0 && (
            <span className={s['material-card__price-usd']}>
              ≈ <CurrencyDisplay value={price / usdRate} currency="USD" />
            </span>
          )}
        </div>
        <div className={s['material-card__actions']}>
          <label className={s['material-card__alt-label']}>
            <input
              type="checkbox"
              className={s['material-card__alt-checkbox']}
              checked={anyAlt}
              onChange={(e) => updateMaterialGroup(indices, 'is_alternative', e.target.checked)}
              disabled={readOnly}
            />
            <span>Alternativa</span>
          </label>
          <button
            type="button"
            className={`${s['material-card__swap']}${pickerOpen ? ` ${s['material-card__swap--active']}` : ''}`}
            onClick={() => setPickerOpen((v) => !v)}
            disabled={readOnly}
            aria-label="Cambiar material"
            title="Cambiar material"
          >
            Cambiar
          </button>
          <button
            type="button"
            className={s['material-card__add']}
            onClick={() => addRow(head)}
            disabled={readOnly}
            aria-label="Agregar otra medida de este material"
            title="Agregar otra medida de este material"
          >
            +
          </button>
          <button
            type="button"
            className={s['material-card__remove']}
            onClick={() => removeGroup(indices)}
            disabled={readOnly}
            aria-label="Eliminar material"
          >
            ✕
          </button>
        </div>
      </div>

      {pickerOpen && (
        <div className={s['material-card__picker']}>
          <MaterialPickerControls
            materials={materials}
            categorias={categorias}
            readOnly={readOnly}
            placeholder="Elegir material…"
            onPick={(mat) => {
              onChangeMaterial(mat);
              setPickerOpen(false);
            }}
          />
        </div>
      )}

      <div className={s['material-card__rows']}>
        {rows.map(({ mat, idx }) => {
          const m2 = rowM2(mat);
          const subtotal = rowSubtotal(mat);
          return (
            <div className={s['material-card__row']} key={idx}>
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
              <div className={`${s['material-card__field']} ${s['material-card__row-subtotal']}`}>
                <label className={s['material-card__label']}>Subtotal</label>
                <span className={s['material-card__row-subtotal-value']}>
                  {m2.toFixed(3)} m² · {formatPrice(subtotal, currency)}
                </span>
              </div>
              {rows.length > 1 && (
                <button
                  type="button"
                  className={`${s['material-card__remove']} ${s['material-card__row-remove']}`}
                  onClick={() => removeMaterial(idx)}
                  disabled={readOnly}
                  aria-label="Eliminar esta medida"
                  title="Eliminar esta medida"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className={s['material-card__footer']}>
        <div className={s['material-card__m2']}>
          <span>
            Rendimiento:{' '}
            <strong className={s['material-card__m2-value']}>
              {totalM2.toFixed(3)} m²
            </strong>
          </span>
        </div>
        <div className={s['material-card__subtotal']}>
          Subtotal: {formatCurrencyValue(totalSubtotal, { currency })}
          {totalSubtotalUsd !== null && (
            <span className={s['material-card__subtotal-usd']}>
              {' '}≈ <CurrencyDisplay value={totalSubtotalUsd} currency="USD" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(MaterialCardInner);
