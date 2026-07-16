import React from 'react';
import { POOL_MATERIAL_GLOBAL, type MaterialInForm } from '../../../types/budget';
import type { AdditionalWork } from '../../../types/additionalWork';
import type { AdditionalWorkSelection } from '../../../hooks/useAdditionalWorkSelection';
import {
  FrenteMaterialOption,
  buildFrenteMaterialOptions,
  resolveFrenteMultiplier,
} from '../../../utils/frentePricing';
import { LinearMetersInput } from '../../common/LinearMetersInput/LinearMetersInput';

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
// Note: this card predates the multi-pane dedup helper
// (`utils/materialGroups.ts`). The picker still renders each snapshot
// row individually — keys collide if the operator adds 3 panes of the
// same marble, but React only warns; the underlying form state
// persists the material by name so picking any of the three identical
// entries binds the row to the same material. Keep behavior unchanged
// unless the operator reports the duplicate picker as a usability
// issue.
import styles from './AdditionalWorkCard.module.css';

const s = styles as unknown as Record<string, string>;

interface AdditionalWorkCardProps {
  selection: AdditionalWorkSelection;
  idx: number;
  formMaterials: MaterialInForm[];
  readOnly: boolean;
  /** Catalogue row matching this selection. Required for `frente`
   *  rows so we know the formula constant; pass `null` when the
   *  catalogue row no longer exists (legacy orphan). */
  catalogueItem: AdditionalWork | null;
  updateAdditionalWork: (
    idx: number,
    field: string,
    value: unknown,
    options?: { catalogueItem?: AdditionalWork | null; materialOptions?: FrenteMaterialOption[] },
  ) => void;
  removeAdditionalWork: (idx: number) => void;
}

export default function AdditionalWorkCard({
  selection,
  idx,
  formMaterials,
  readOnly,
  catalogueItem,
  updateAdditionalWork,
  removeAdditionalWork,
}: AdditionalWorkCardProps) {
  const isFrente = selection.type === 'frente';
  const materialOptions = React.useMemo(
    () => buildFrenteMaterialOptions({ materials: formMaterials }),
    [formMaterials],
  );
  const formulaMultiplier = catalogueItem
    ? resolveFrenteMultiplier(catalogueItem)
    : null;
  const formulaM2 = selection.formula_values?.material_price_m2_at_selection ?? null;
  const formulaAt = selection.formula_values?.computed_at ?? null;

  return (
    <div
      className={s['additional-work-card']}
      data-type={selection.type}
      data-testid={`additional-work-card-${selection.additional_work_id ?? idx}`}
    >
      <div className={s['additional-work-card__header']}>
        <span className={s['additional-work-card__title']}>{selection.name}</span>
        {selection.detail && (
          <span className={s['additional-work-card__detail']}>{selection.detail}</span>
        )}
        <span className={s['additional-work-card__type-pill']} aria-hidden={!isFrente}>
          {isFrente ? 'FRENTE' : 'FLAT'}
        </span>
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

      {isFrente ? (
        <div className={s['additional-work-card__fields']}>
          <div
            className={`${s['additional-work-card__field']} ${s['additional-work-card__field--material']}`}
          >
            <label
              className={s['additional-work-card__label']}
              title="Material cuyo precio por m² alimenta la fórmula (precio_m2 × 0.13 × multiplicador)."
            >
              Asignar material
            </label>
            <select
              className={`input ${s['additional-work-card__select']}`}
              data-testid="frente-assign-material"
              value={selection.assigned_material_id ?? ''}
              onChange={(e) =>
                updateAdditionalWork(idx, 'assigned_material_id', e.target.value, {
                  catalogueItem,
                  materialOptions,
                })
              }
              disabled={readOnly}
            >
              <option value="">Seleccionar…</option>
              {materialOptions.length === 0 ? (
                <option value="" disabled>
                  (Agregá un material arriba para poder asignar)
                </option>
              ) : null}
              {materialOptions.map((m) => (
                <option
                  key={`${m.id ?? m.name}-${m.is_alternative ? 'alt' : 'pri'}`}
                  value={m.id != null ? String(m.id) : m.name}
                  data-testid={`frente-assign-material-option-${m.name}`}
                >
                  {m.is_alternative ? 'Alternativa: ' : 'Principal: '}
                  {m.name} ({m.currency} {formatNumber(m.price_per_m2)}/m²)
                </option>
              ))}
            </select>
            {materialOptions.some((m) => m.id == null) ? (
              <small className={s['additional-work-card__formula']}>
                Algún material no tiene id de catálogo: la fórmula se calculará
                con el precio guardado al guardar (el backend igual la procesa).
              </small>
            ) : null}
          </div>

          <div className={`${s['additional-work-card__field']} ${s['additional-work-card__field--cant']}`}>
            <label
              className={s['additional-work-card__label']}
              title="Metros lineales de frente / regrueso a cobrar."
            >
              Metros Lineales
            </label>
            <LinearMetersInput
              className={`input ${s['additional-work-card__input']}`}
              value={selection.linear_meters}
              disabled={readOnly}
              onCommit={(n) =>
                updateAdditionalWork(idx, 'linear_meters', n, {
                  catalogueItem,
                  materialOptions,
                })
              }
            />
          </div>

          <div className={`${s['additional-work-card__field']} ${s['additional-work-card__field--subtotal']}`}>
            <label className={s['additional-work-card__label']}>Subtotal</label>
            <strong className={s['additional-work-card__subtotal']}>
              {selection.currency === 'USD' ? 'USD ' : '$ '}
              {formatNumber(selection.total || 0)}
            </strong>
            <small className={s['additional-work-card__formula']}>
              {formulaM2 !== null && formulaMultiplier !== null ? (
                <>
                  {formatNumber(formulaM2)} × 0.13 × {formatNumber(formulaMultiplier)} ×{' '}
                  {formatNumber(Number(selection.linear_meters || 0))} ml ={' '}
                  {formatNumber(Number(selection.price) || 0)}/ml
                </>
              ) : (
                <>Asigná un material y cargá los metros lineales.</>
              )}
            </small>
            {formulaAt ? (
              <small className={s['additional-work-card__formula-audit']}>
                Frozen {new Date(formulaAt).toLocaleString('es-AR')}
              </small>
            ) : null}
          </div>
        </div>
      ) : (
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
          <div
            className={`${s['additional-work-card__field']} ${s['additional-work-card__field--material']}`}
          >
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
                  {(m.is_alternative ? 'Alternativa: ' : 'Principal: ')}
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}


