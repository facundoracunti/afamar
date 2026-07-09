import React from 'react';
import { POOL_MATERIAL_GLOBAL, type MaterialInForm } from '../../../types/budget';
import type { AdditionalWorkSelection } from '../../../hooks/useAdditionalWorkSelection';
import styles from './AdditionalWorkCard.module.css';

const s = styles as unknown as Record<string, string>;

interface AdditionalWorkCardProps {
  selection: AdditionalWorkSelection;
  idx: number;
  formMaterials: MaterialInForm[];
  readOnly: boolean;
  updateAdditionalWork: (idx: number, field: string, value: unknown) => void;
  removeAdditionalWork: (idx: number) => void;
}

export default function AdditionalWorkCard({
  selection,
  idx,
  formMaterials,
  readOnly,
  updateAdditionalWork,
  removeAdditionalWork,
}: AdditionalWorkCardProps) {
  return (
    <div className={s['additional-work-card']}>
      <div className={s['additional-work-card__header']}>
        <span className={s['additional-work-card__title']}>{selection.name}</span>
        {selection.detail && (
          <span className={s['additional-work-card__detail']}>{selection.detail}</span>
        )}
        <button
          type="button"
          onClick={() => removeAdditionalWork(idx)}
          className={s['additional-work-card__remove']}
          disabled={readOnly}
          aria-label="Eliminar trabajo adicional"
        >
          ✕
        </button>
      </div>
      <div className={s['additional-work-card__fields']}>
        <div className={`${s['additional-work-card__field']} ${s['additional-work-card__field--cant']}`}>
          <label className={s['additional-work-card__label']}>Cant.</label>
          <input
            className={`input ${s['additional-work-card__input']}`}
            type="number"
            min="1"
            value={selection.quantity || 1}
            onChange={(e) => updateAdditionalWork(idx, 'quantity', Number(e.target.value) || 1)}
            disabled={readOnly}
          />
        </div>
        <div className={`${s['additional-work-card__field']} ${s['additional-work-card__field--precio']}`}>
          <label className={s['additional-work-card__label']}>Precio</label>
          <input
            className={`input ${s['additional-work-card__input']}`}
            type="number"
            step="0.01"
            value={selection.price || ''}
            onChange={(e) => updateAdditionalWork(idx, 'price', Number(e.target.value) || 0)}
            disabled={readOnly}
          />
        </div>
        <div className={`${s['additional-work-card__field']} ${s['additional-work-card__field--material']}`}>
          <label
            className={s['additional-work-card__label']}
            title="Asigna este trabajo adicional a un material/alternativa específico, o a la sección 'Extras / Global' (suma al total y a cada alternativa)."
          >
            Asignar a opción
          </label>
          <select
            className={`input ${s['additional-work-card__select']}`}
            value={selection.materialName ?? POOL_MATERIAL_GLOBAL}
            onChange={(e) => updateAdditionalWork(idx, 'materialName', e.target.value)}
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
