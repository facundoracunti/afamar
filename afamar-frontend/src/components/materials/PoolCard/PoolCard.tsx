import React from 'react';
import type { PoolInForm } from '../../../types/budget';
import styles from './PoolCard.module.css';

const s = styles as unknown as Record<string, string>;

interface PoolCardProps {
  pt: PoolInForm;
  idx: number;
  pools: Record<string, unknown>[];
  readOnly: boolean;
  updatePileta: (idx: number, field: string, value: unknown) => void;
  removePileta: (idx: number) => void;
  formPiletas: Record<string, unknown>[];
  update: (field: string, value: unknown) => void;
  num: (v: unknown) => number;
}

export default function PoolCard({
  pt, idx, pools, readOnly, updatePileta, removePileta, formPiletas, update, num,
}: PoolCardProps) {
  return (
    <div className={s['pool-card']}>
      <div className={s['pool-card__header']}>
        <span className={s['pool-card__title']}>{pt.brand} - {pt.model}</span>
        <button
          type="button"
          onClick={() => removePileta(idx)}
          className={s['pool-card__remove']}
          disabled={readOnly}
          aria-label="Eliminar pileta"
        >
          ✕
        </button>
      </div>
      <div className={s['pool-card__fields']}>
        <div className={`${s['pool-card__field']} ${s['pool-card__field--cant']}`}>
          <label className={s['pool-card__label']}>Cant.</label>
          <input
            className={`input ${s['pool-card__input']}`}
            type="number"
            min="1"
            value={pt.quantity || 1}
            onChange={(e) => updatePileta(idx, 'quantity', num(e.target.value))}
            disabled={readOnly}
          />
        </div>
        <div className={`${s['pool-card__field']} ${s['pool-card__field--moneda']}`}>
          <label className={s['pool-card__label']}>Moneda</label>
          <select
            className={`input ${s['pool-card__select']}`}
            value={pt.currency}
            onChange={(e) => {
              const mon = e.target.value;
              const pdata = pools.find((p) => p.id === Number(pt.pool_id));
              const precio = pdata
                ? (mon === 'USD' ? Number(pdata.price_usd ?? 0) : Number(pdata.price ?? 0))
                : Number(pt.price ?? 0);
              const list = [...formPiletas];
              list[idx] = { ...list[idx], currency: mon as 'ARS' | 'USD', price: precio };
              update('pools_data', list);
            }}
            disabled={readOnly}
          >
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </div>
        <div className={`${s['pool-card__field']} ${s['pool-card__field--precio']}`}>
          <label className={s['pool-card__label']}>Precio</label>
          <input
            className={`input ${s['pool-card__input']}`}
            type="number"
            step="0.01"
            value={pt.price || ''}
            onChange={(e) => updatePileta(idx, 'price', num(e.target.value))}
            disabled={readOnly}
          />
        </div>
      </div>
    </div>
  );
}