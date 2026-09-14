import React from 'react';
import { POOL_MATERIAL_GLOBAL, type MaterialInForm, type PoolInForm } from '../../../types/budget';
import styles from './PoolCard.module.css';

const s = styles as unknown as Record<string, string>;

/** Prefix for material-option select values: `__MAT__{index}` points at a
 *  specific `formMaterials` row so pools with the same material name but
 *  different dimensions resolve to distinct dropdown options. */
const MAT_OPTION_PREFIX = '__MAT__';

/** Round and render a measurement as a compact `L X A` label. */
function dimsLabel(m: MaterialInForm): string {
  const round2 = (v?: number) => (v == null || Number.isNaN(v)) ? 0 : Number(v.toFixed(2));
  return `${round2(m.length)} X ${round2(m.width)}`;
}

/** Map the pool's persisted assignment (`material` + optional `mesada_*`)
 *  back to a dropdown option value. Falls back to the global sentinel when
 *  no `formMaterials` row matches (material swapped away, etc.). */
function currentOptionValue(
  pt: PoolInForm,
  formMaterials: MaterialInForm[]
): string {
  if (!pt.material || pt.material === POOL_MATERIAL_GLOBAL) return POOL_MATERIAL_GLOBAL;
  const idx = formMaterials.findIndex(
    (m) => m.name === pt.material &&
      (pt.mesada_length == null || round2(m.length) === round2(pt.mesada_length)) &&
      (pt.mesada_width == null || round2(m.width) === round2(pt.mesada_width))
  );
  return idx >= 0 ? `${MAT_OPTION_PREFIX}${idx}` : POOL_MATERIAL_GLOBAL;
}

function round2(v?: number): number {
  return (v == null || Number.isNaN(v)) ? 0 : Number(v.toFixed(2));
}

interface PoolCardProps {
  pt: PoolInForm;
  idx: number;
  /** Materials added to the current budget/WorkOrder (main + alternatives).
   *  Powers the "Asignar a opción" picker so the pool can be linked to a
   *  specific material section in the PDF. Each row is an option — same-name
   *  rows are disambiguated by their dimensions. */
  formMaterials: MaterialInForm[];
  readOnly: boolean;
  updatePileta: (idx: number, field: string, value: unknown) => void;
  setPoolFields: (idx: number, fields: Record<string, unknown>) => void;
  removePileta: (idx: number) => void;
  num: (v: unknown) => number;
}

function PoolCardInner({
  pt, idx, formMaterials, readOnly, updatePileta, setPoolFields, removePileta, num,
}: PoolCardProps) {
  const handleMaterialChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === POOL_MATERIAL_GLOBAL) {
      setPoolFields(idx, {
        material: POOL_MATERIAL_GLOBAL,
        mesada_length: undefined,
        mesada_width: undefined,
      });
      return;
    }
    const matIdx = Number(value.slice(MAT_OPTION_PREFIX.length));
    const mat = formMaterials[matIdx];
    if (!mat) return;
    setPoolFields(idx, {
      material: mat.name,
      mesada_length: round2(mat.length),
      mesada_width: round2(mat.width),
    });
  };

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
            title="Asigna esta pileta a una mesada concreta (por material y medidas), o a la sección 'Extras / Global' (suma al total y a cada alternativa)."
          >
            Asignar a opción
          </label>
          <select
            className={`input ${s['pool-card__select']}`}
            value={currentOptionValue(pt, formMaterials)}
            onChange={handleMaterialChange}
            disabled={readOnly}
          >
            <option value={POOL_MATERIAL_GLOBAL}>(Global — suma al total)</option>
            {formMaterials.length === 0 ? (
              <option value="" disabled>
                (Agregá un material arriba para poder asignar)
              </option>
            ) : null}
            {formMaterials
              .map((m, i) => ({ m, i }))
              .sort((a, b) => {
                const nameCmp = `${a.m.name}`.toLowerCase().localeCompare(`${b.m.name}`.toLowerCase());
                if (nameCmp !== 0) return nameCmp;
                return dimsLabel(a.m).localeCompare(dimsLabel(b.m));
              })
              .map(({ m, i }) => (
                <option key={`${m.name}|${dimsLabel(m)}|${i}`} value={`${MAT_OPTION_PREFIX}${i}`}>
                  {(m.is_alternative ? 'Alternativa: ' : 'Principal: ')}{m.name} {dimsLabel(m)}
                </option>
              ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export default React.memo(PoolCardInner);
