import React from 'react';
import { POOL_MATERIAL_GLOBAL, type MaterialInForm, type PoolInForm } from '../../../types/budget';
import styles from './PoolCard.module.css';

const s = styles as unknown as Record<string, string>;

interface PoolCardProps {
  pt: PoolInForm;
  idx: number;
  /** Materials added to the current budget/WorkOrder (main + alternatives).
   *  Powers the "Asignar a opción" picker so the pool can be linked to a
   *  specific material section in the PDF. */
  formMaterials: MaterialInForm[];
  readOnly: boolean;
  updatePileta: (idx: number, field: string, value: unknown) => void;
  removePileta: (idx: number) => void;
  num: (v: unknown) => number;
}

export default function PoolCard({
  pt, idx, formMaterials, readOnly, updatePileta, removePileta, num,
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
        <div className={`${s['pool-card__field']} ${s['pool-card__field--material']}`}>
          <label
            className={s['pool-card__label']}
            title="Asigna esta pileta a un material/alternativa específico, o a la sección 'Extras / Global' (suma al total y a cada alternativa)."
          >
            Asignar a opción
          </label>
          <select
            className={`input ${s['pool-card__select']}`}
            value={pt.material || POOL_MATERIAL_GLOBAL}
            onChange={(e) => updatePileta(idx, 'material', e.target.value)}
            disabled={readOnly}
          >
            <option value={POOL_MATERIAL_GLOBAL}>(Global — suma al total)</option>
            {formMaterials.length === 0 ? (
              <option value="" disabled>
                (Agregá un material arriba para poder asignar)
              </option>
            ) : null}
            {formMaterials.map((m) => (
              <option key={m.name} value={m.name}>
                {(m.is_alternative ? 'Alternativa: ' : 'Principal: ')}{m.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
