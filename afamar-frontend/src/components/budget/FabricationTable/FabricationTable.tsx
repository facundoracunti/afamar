import React from 'react';
import { Plus, X } from 'lucide-react';
import { t } from '../../../utils/translate';
import type { FabricationDetail, MaterialInForm } from '../../../types/budget';
import styles from './FabricationTable.module.css';

const s = styles as unknown as Record<string, string>;

interface FabricationTableProps {
  detalles: FabricationDetail[];
  readOnly: boolean;
  handleDetailChange: (i: number, field: string, value: unknown) => void;
  addDetalle: () => void;
  removeDetalle: (i: number) => void;
  /**
   * The materials added to the current budget/WorkOrder (main + alternatives).
   * Powers the "Asignar a opción" picker so fabrication details can be
   * linked to a specific material section in the PDF. Pass an empty array
   * when the user hasn't added any materials yet — the only option shown
   * will then be "(Global — suma al total)".
   */
  formMaterials: MaterialInForm[];
  M2_CONCEPTS: string[];
  fabricationConcepts: string[];
  num: (v: unknown) => number;
}

// FabricationDetail uses English snake_case field names (concept, detail, etc.)
// because the backend serializes fabrication_details as a JSON string column,
// not typed fields.
//
// The `material` field doubles as the "asociar a opción" link: any detail with
// `material === "<nombre de material>"` is rendered inside that material's
// section in the PDF (zocalos, frentes, traforos, etc.). Details with an
// empty `material` go to the "Extras / Global" section.

const CURRENCY_COLOR: Record<'ARS' | 'USD', string> = {
  ARS: 'var(--text-secondary)',
  USD: 'var(--color-success)',
};

const currencyLabel = (c: 'ARS' | 'USD', value: number) =>
  `${c === 'USD' ? 'USD ' : '$ '}${value.toLocaleString('es-AR')}`;

function isM2Concept(concept: string, m2Concepts: string[]): boolean {
  return m2Concepts.includes(concept);
}

function isCutoutConcept(concept: string): boolean {
  return ['CUTOUT_SINK', 'CUTOUT_COOKTOP', 'CUTOUT_DROPIN_SINK'].includes(concept);
}

function isM2OrCutout(concept: string, m2Concepts: string[]): boolean {
  return isM2Concept(concept, m2Concepts) || isCutoutConcept(concept);
}

function precioCellValue(
  d: FabricationDetail,
  m2Concepts: string[],
): { type: 'currency'; value: number; currency: 'ARS' | 'USD' }
  | { type: 'input' }
  | { type: 'dash' } {
  if (isM2Concept(d.concept, m2Concepts) || d.concept === 'OTHER') {
    return { type: 'currency', value: Number(d.price || 0), currency: d.currency };
  }
  if (isCutoutConcept(d.concept)) {
    return { type: 'input' };
  }
  return { type: 'dash' };
}

export default function FabricationTable({
  detalles, readOnly, handleDetailChange, addDetalle, removeDetalle,
  formMaterials, M2_CONCEPTS, fabricationConcepts, num,
}: FabricationTableProps) {
  return (
    <div className={s['fabrication-table']}>
      <h3 className="section-title">DETALLE DE FABRICACIÓN Y ADICIONALES</h3>
      <table className={`table ${s['fabrication-table__table']}`}>
        <thead>
          <tr>
            <th>Concepto</th>
            <th className={s['fabrication-table__th--asignar']}>Asignar a opción</th>
            <th>Detalle</th>
            <th className={s['fabrication-table__th--precio']}>Precio</th>
            <th className={s['fabrication-table__th--cant']}>Cant</th>
            <th className={s['fabrication-table__th--actions']}></th>
          </tr>
        </thead>
        <tbody>
          {detalles.map((d, i) => {
            const isM2 = isM2Concept(d.concept, M2_CONCEPTS);
            const showQuantity = isM2 || isM2OrCutout(d.concept, M2_CONCEPTS);
            const assignedMaterial = (d.material as string | undefined) || '';
            const selectValue = assignedMaterial || (isM2 ? '' : '__GLOBAL__');
            return (
              <tr key={i}>
                <td>
                  <select
                    className={`input ${s['fabrication-table__select-compact']}`}
                    value={d.concept}
                    onChange={(e) => handleDetailChange(i, 'concept', e.target.value)}
                    disabled={readOnly}
                  >
                    {fabricationConcepts.map((c) => <option key={c} value={c}>{t(c)}</option>)}
                  </select>
                </td>
                <td>
                  <select
                    className={`input ${s['fabrication-table__select-asignar']}`}
                    value={selectValue}
                    onChange={(e) => handleDetailChange(
                      i,
                      'material',
                      e.target.value === '__GLOBAL__' ? '' : e.target.value,
                    )}
                    disabled={readOnly}
                    title="Asocia este concepto a la sección de un material específico (zocalo/frente de GRIS MARA, traforo de pileta sobre TAJ MAHAL, etc.). Vacío = sección global de extras."
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
                </td>
                <td>
                  {isM2 ? (
                    <div className={s['fabrication-table__inline-fields']}>
                      <input
                        className={`input ${s['fabrication-table__input-m2']}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={d.length ?? ''}
                        onChange={(e) => handleDetailChange(i, 'length', num(e.target.value))}
                        placeholder="Largo"
                        disabled={readOnly}
                      />
                      <span className={s['fabrication-table__mult']}>×</span>
                      <input
                        className={`input ${s['fabrication-table__input-m2']}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={d.width ?? ''}
                        onChange={(e) => handleDetailChange(i, 'width', num(e.target.value))}
                        placeholder="Ancho"
                        disabled={readOnly}
                      />
                      <span className={s['fabrication-table__m2-readout']}>{(d.m2 || 0)} m²</span>
                    </div>
                  ) : d.concept === 'OTHER' ? (
                    <div className={s['fabrication-table__stacked']}>
                      <input
                        className={`input ${s['fabrication-table__input-stacked']}`}
                        value={d.detail || ''}
                        onChange={(e) => handleDetailChange(i, 'detail', e.target.value)}
                        placeholder="DETALLES"
                        disabled={readOnly}
                      />
                      <div className={s['fabrication-table__inline-fields']}>
                        <input
                          className={`input ${s['fabrication-table__input-m2']}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={d.length ?? ''}
                          onChange={(e) => handleDetailChange(i, 'length', num(e.target.value))}
                          placeholder="Largo"
                          disabled={readOnly}
                        />
                        <span className={s['fabrication-table__mult']}>×</span>
                        <input
                          className={`input ${s['fabrication-table__input-m2']}`}
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
                      className={`input ${s['fabrication-table__input-stacked']}`}
                      value={d.detail || ''}
                      onChange={(e) => handleDetailChange(i, 'detail', e.target.value)}
                      placeholder="Cant / ML / cm"
                      disabled={readOnly}
                    />
                  )}
                </td>
                <td>
                  {(() => {
                    const cell = precioCellValue(d, M2_CONCEPTS);
                    if (cell.type === 'currency') {
                      return (
                        <span
                          className={s['fabrication-table__currency']}
                          style={{ color: CURRENCY_COLOR[cell.currency] }}
                        >
                          {currencyLabel(cell.currency, cell.value)}
                        </span>
                      );
                    }
                    if (cell.type === 'input') {
                      return (
                        <input
                          className={`input ${s['fabrication-table__input-stacked']}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={d.price || ''}
                          onChange={(e) => handleDetailChange(i, 'price', num(e.target.value))}
                          placeholder="0"
                          disabled={readOnly}
                        />
                      );
                    }
                    return <span className={s['fabrication-table__dash']}>-</span>;
                  })()}
                </td>
                <td>
                  <input
                    className={`input ${s['fabrication-table__cant']}`}
                    type="number"
                    min="1"
                    value={d.quantity || 1}
                    onChange={(e) => handleDetailChange(i, 'quantity', num(e.target.value))}
                    disabled={readOnly}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className={`btn btn-outline ${s['fabrication-table__remove-btn']}`}
                    onClick={() => removeDetalle(i)}
                    disabled={readOnly}
                    aria-label="Eliminar concepto"
                  >
                    <X size={14} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button
        type="button"
        className={`btn btn-outline ${s['fabrication-table__add-btn']}`}
        onClick={addDetalle}
        disabled={readOnly}
      >
        <Plus size={14} /> Agregar concepto
      </button>
    </div>
  );
}
