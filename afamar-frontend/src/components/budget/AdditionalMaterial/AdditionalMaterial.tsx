import React from 'react';
import { Plus } from 'lucide-react';
import type { FabricationDetail, MaterialInForm } from '../../../types/budget';
import { formatCurrencyValue } from '../../../utils/formatters';
import styles from './AdditionalMaterial.module.css';

const s = styles as unknown as Record<string, string>;

interface AdditionalMaterialProps {
  detalles: FabricationDetail[];
  readOnly: boolean;
  handleDetailChange: (i: number, field: string, value: unknown) => void;
  addDetalle: () => void;
  removeDetalle: (i: number) => void;
  formMaterials: MaterialInForm[];
  M2_CONCEPTS: string[];
  num: (v: unknown) => number;
}

function isM2Concept(concept: string, m2Concepts: string[]): boolean {
  return m2Concepts.includes(concept);
}

function isCutoutConcept(concept: string): boolean {
  return ['CUTOUT_SINK', 'CUTOUT_COOKTOP', 'CUTOUT_DROPIN_SINK'].includes(concept);
}

function computeM2(d: FabricationDetail): number {
  return Number(d.length || 0) * Number(d.width || 0) * Number(d.quantity || 1);
}

function formatPrice(n: number, currency: 'ARS' | 'USD'): string {
  return formatCurrencyValue(n, { currency });
}

export default function AdditionalMaterial({
  detalles, readOnly, handleDetailChange, addDetalle, removeDetalle,
  formMaterials, M2_CONCEPTS, num,
}: AdditionalMaterialProps) {
  return (
    <div className={s['additional-material']}>
      <h3 className="section-title">MATERIALES ADICIONALES</h3>

      {detalles.length === 0 && (
        <div className={s['additional-material__empty']}>
          Sin materiales adicionales. Usá "+ AGREGAR CONCEPTO" para sumar.
        </div>
      )}

      <div className={s['additional-material__cards']}>
        {detalles.map((d, i) => {
          const isM2 = isM2Concept(d.concept, M2_CONCEPTS);
          const assignedMaterial = (d.material as string | undefined) || '';
          const m2 = computeM2(d);
          const totalPrice = Number(d.price || 0) * Number(d.quantity || 1);
          return (
            <div key={i} className={s['additional-material__card']}>
              <div className={s['additional-material__card-header']}>
                <select
                  className={`input ${s['additional-material__select-concept']}`}
                  value={d.concept}
                  onChange={(e) => handleDetailChange(i, 'concept', e.target.value)}
                  disabled={readOnly}
                >
                  <option value="BASEBOARD">Zócalo</option>
                  <option value="FRONT">Frente</option>
                </select>
                <button
                  type="button"
                  className={s['additional-material__remove']}
                  onClick={() => removeDetalle(i)}
                  disabled={readOnly}
                  aria-label="Eliminar concepto"
                >
                  ✕
                </button>
              </div>

              <div className={s['additional-material__fields']}>
                <div className={s['additional-material__field']}>
                  <label className={s['additional-material__label']}>Asignar a opción</label>
                  <select
                    className={`input ${s['additional-material__input']}`}
                    value={assignedMaterial || '__GLOBAL__'}
                    onChange={(e) => handleDetailChange(
                      i,
                      'material',
                      e.target.value === '__GLOBAL__' ? '' : e.target.value,
                    )}
                    disabled={readOnly}
                    title="Asocia este concepto a la sección de un material específico. Vacío = sección global de extras."
                  >
                    <option value="">(Global — suma al total)</option>
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

                <div className={s['additional-material__field']}>
                  <label className={s['additional-material__label']}>Detalle</label>
                  {isM2 ? (
                    <div className={s['additional-material__m2-fields']}>
                      <input
                        className={`input ${s['additional-material__input-sm']}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={d.length ?? ''}
                        onChange={(e) => handleDetailChange(i, 'length', num(e.target.value))}
                        placeholder="Largo"
                        disabled={readOnly}
                      />
                      <span className={s['additional-material__mult']}>×</span>
                      <input
                        className={`input ${s['additional-material__input-sm']}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={d.width ?? ''}
                        onChange={(e) => handleDetailChange(i, 'width', num(e.target.value))}
                        placeholder="Ancho"
                        disabled={readOnly}
                      />
                    </div>
                  ) : d.concept === 'OTHER' ? (
                    <div className={s['additional-material__stacked']}>
                      <input
                        className={`input ${s['additional-material__input']}`}
                        value={d.detail || ''}
                        onChange={(e) => handleDetailChange(i, 'detail', e.target.value)}
                        placeholder="DETALLES"
                        disabled={readOnly}
                      />
                      <div className={s['additional-material__m2-fields']}>
                        <input
                          className={`input ${s['additional-material__input-sm']}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={d.length ?? ''}
                          onChange={(e) => handleDetailChange(i, 'length', num(e.target.value))}
                          placeholder="Largo"
                          disabled={readOnly}
                        />
                        <span className={s['additional-material__mult']}>×</span>
                        <input
                          className={`input ${s['additional-material__input-sm']}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={d.labor ?? ''}
                          onChange={(e) => handleDetailChange(i, 'labor', num(e.target.value))}
                          placeholder="Mano de obra"
                          disabled={readOnly}
                        />
                      </div>
                    </div>
                  ) : (
                    <input
                      className={`input ${s['additional-material__input']}`}
                      value={d.detail || ''}
                      onChange={(e) => handleDetailChange(i, 'detail', e.target.value)}
                      placeholder="Cant / ML / cm"
                      disabled={readOnly}
                    />
                  )}
                </div>

                <div className={s['additional-material__field']}>
                  <label className={s['additional-material__label']}>Precio</label>
                  {isM2 || d.concept === 'OTHER' ? (
                    <span className={`${s['additional-material__price']} ${d.currency === 'USD' ? s['additional-material__price--usd'] : ''}`}>
                      {formatPrice(Number(d.price || 0), d.currency)}
                    </span>
                  ) : isCutoutConcept(d.concept) ? (
                    <input
                      className={`input ${s['additional-material__input']}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={d.price || ''}
                      onChange={(e) => handleDetailChange(i, 'price', num(e.target.value))}
                      placeholder="0"
                      disabled={readOnly}
                    />
                  ) : (
                    <span className={s['additional-material__dash']}>-</span>
                  )}
                </div>

                <div className={s['additional-material__field']}>
                  <label className={s['additional-material__label']}>Cant.</label>
                  <input
                    className={`input ${s['additional-material__input']}`}
                    type="number"
                    min="1"
                    value={d.quantity || 1}
                    onChange={(e) => handleDetailChange(i, 'quantity', num(e.target.value))}
                    disabled={readOnly}
                  />
                </div>
              </div>

              <div className={s['additional-material__card-footer']}>
                {isM2 && m2 > 0 && (
                  <span className={s['additional-material__m2']}>
                    {m2.toFixed(3)} m²
                  </span>
                )}
                {totalPrice > 0 && (
                  <span className={s['additional-material__subtotal']}>
                    Subtotal: {formatPrice(totalPrice, d.currency)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        className={`btn btn-outline ${s['additional-material__add-btn']}`}
        onClick={addDetalle}
        disabled={readOnly}
      >
        <Plus size={14} /> Agregar concepto
      </button>
    </div>
  );
}
