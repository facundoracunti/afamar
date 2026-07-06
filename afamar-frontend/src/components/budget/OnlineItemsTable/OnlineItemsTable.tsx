import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Material } from '../../../types/material';
import type { Pool } from '../../../types/poolStock';
import styles from './OnlineItemsTable.module.css';

const s = styles as unknown as Record<string, string>;

export interface OnlineBudgetItemLocal {
  detail: string;
  length: number;
  width: number;
  m2: number;
  isUnit: boolean;
  currency: 'ARS' | 'USD';
  labor: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  material: string;
  pool_id: number | null;
  option: number;
}

export interface OptionTab {
  nombre: string;
  items: OnlineBudgetItemLocal[];
  especiales: OnlineBudgetItemLocal[];
  matEspeciales: Record<number, string>;
}

export const INITIAL_ROWS = Array.from({ length: 3 }, (): Partial<OnlineBudgetItemLocal> => ({ detail: 'LONGITUD', isUnit: false }));
export const INITIAL_SPECIALS = [{ detail: 'ZOCALOS', isUnit: false }] as const;
export const SPECIAL_TYPES: { detail: string; isUnit: boolean }[] = [
  { detail: 'ZOCALOS', isUnit: false },
  { detail: 'CUTOUT_SINK', isUnit: true },
  { detail: 'CUTOUT_DROPIN_SINK', isUnit: true },
  { detail: 'CUTOUT_COOKTOP', isUnit: true },
  { detail: 'TERMINACION', isUnit: true },
  { detail: 'PILETA MOD', isUnit: true },
];
export const SPECIAL_NAMES = new Set(SPECIAL_TYPES.map((t) => t.detail));

export function emptyItem(detail: string = 'LONGITUD', isUnit: boolean = false): OnlineBudgetItemLocal {
  return { detail, length: 0, width: 0, m2: 0, isUnit, currency: 'ARS' as const, labor: 0, quantity: 1, unitPrice: 0, subtotal: 0, material: '', pool_id: null, option: 0 };
}

export function parseNum(v: unknown): number {
  return v === '' || v === null || v === undefined ? 0 : Number(v);
}

export function createOption(): OptionTab {
  return {
    nombre: 'Opción 1',
    items: INITIAL_ROWS.map((f) => emptyItem(f.detail, f.isUnit)),
    especiales: INITIAL_SPECIALS.map((e) => emptyItem(e.detail, e.isUnit)),
    matEspeciales: {},
  };
}

interface Props {
  opciones: OptionTab[];
  setOpciones: React.Dispatch<React.SetStateAction<OptionTab[]>>;
  activeOpcion: number;
  setActiveOpcion: React.Dispatch<React.SetStateAction<number>>;
  materiales: Material[];
  piletas: Pool[];
  isEdit: boolean;
  convertingOpcion: number | null;
  onConvertirOpcion: (opcionIdx: number) => void;
}

const inputRight = s['oit__input'];
const inputText = s['oit__input--text']
  ? `${s['oit__input']} ${s['oit__input--text']}`
  : s['oit__input'];
const selectStyle = s['oit__select'];
const cellStyle = s['oit__cell'];
const thCenter = `${s['oit__th']} ${s['oit__th--center']}`;
const thCenterNarrow = `${s['oit__th']} ${s['oit__th--center-narrow']}`;
const thRight = `${s['oit__th']} ${s['oit__th--right']}`;
const thLeft = `${s['oit__th']} ${s['oit__th--left']}`;
const thAction = `${s['oit__th']} ${s['oit__th--action']}`;
const subtotalUsd = `${s['oit__subtotal']} ${s['oit__subtotal--usd']}`;

export default function OnlineItemsTable({
  opciones, setOpciones, activeOpcion, setActiveOpcion,
  materiales, piletas, isEdit, convertingOpcion, onConvertirOpcion,
}: Props) {
  const [nuevoEspecial, setNuevoEspecial] = useState<string>('');

  const getRenderedItems = (): OnlineBudgetItemLocal[] => {
    return opciones[activeOpcion]?.items || [];
  };

  const updateAndSync = (tabIdx: number, itemIdx: number, field: string, value: unknown) => {
    const numericFields = ['length', 'width', 'm2', 'labor', 'quantity', 'unitPrice', 'subtotal'];
    const parsed = numericFields.includes(field) ? parseNum(value) : value;
    const measureFields = ['length', 'width', 'quantity'];

    setOpciones((prev: OptionTab[]) => {
      const next = prev.map((tab: OptionTab, ti: number) => {
        const items = [...tab.items];
        if (!items[itemIdx]) return tab;
        const updated = { ...items[itemIdx], [field]: parsed } as OnlineBudgetItemLocal;
        items[itemIdx] = updated;

        if (field === 'length' || field === 'width' || field === 'labor') {
          const la = Number(updated.length) || 0;
          const an = Number(updated.width) || 0;
          if (updated.detail === 'TERMINACION') {
            const mo = Number(updated.labor) || 0;
            updated.subtotal = Math.round(la * mo * 100) / 100;
            updated.unitPrice = Math.round(la * mo * 100) / 100;
          } else if (!updated.isUnit) {
            updated.m2 = Math.round(la * an * 100000) / 100000;
          }
        }

        if (!measureFields.includes(field) || ti === tabIdx) {
          const m2 = updated.m2 || 0;
          const cant = Number(updated.quantity) || 1;
          const pu = Number(updated.unitPrice) || 0;
          if (updated.detail === 'TERMINACION') {
          } else if (updated.isUnit) {
            updated.subtotal = Math.round(cant * pu * 100) / 100;
          } else if (m2 > 0) {
            updated.subtotal = Math.round(m2 * cant * pu * 100) / 100;
          } else {
            updated.subtotal = Math.round(cant * pu * 100) / 100;
          }
        }

        return { ...tab, items };
      });

      if (measureFields.includes(field)) {
        const srcTab = next[tabIdx];
        if (srcTab) {
          const medidas = srcTab.items.map((i: OnlineBudgetItemLocal) => ({ length: i.length, width: i.width, quantity: i.quantity }));
          for (let ti = 0; ti < next.length; ti++) {
            if (ti === tabIdx) continue;
            const tabItems = [...next[ti].items];
            for (let ii = 0; ii < tabItems.length && ii < medidas.length; ii++) {
              const m = medidas[ii];
              const prevItem = prev[ti]?.items[ii] || tabItems[ii];
              const m2 = Math.round((m.length || 0) * (m.width || 0) * 100000) / 100000;
              const pu = Number(prevItem.unitPrice) || 0;
              const cant = m.quantity || 1;
              let subtotal = 0;
              if (prevItem.detail === 'TERMINACION') {
                subtotal = Math.round((m.length || 0) * (prevItem.labor || 0) * 100) / 100;
              } else if (prevItem.isUnit) {
                subtotal = Math.round(cant * pu * 100) / 100;
              } else if (m2 > 0) {
                subtotal = Math.round(m2 * cant * pu * 100) / 100;
              } else {
                subtotal = Math.round(cant * pu * 100) / 100;
              }
              tabItems[ii] = {
                ...tabItems[ii],
                length: m.length,
                width: m.width,
                quantity: m.quantity,
                m2,
                subtotal,
              } as OnlineBudgetItemLocal;
            }
            next[ti] = { ...next[ti], items: tabItems };
          }
        }
      }

      return next;
    });
  };

  const addItem = () => {
    setOpciones((prev: OptionTab[]) => {
      const newItem = emptyItem('LONGITUD', false);
      return prev.map((tab: OptionTab) => {
        return { ...tab, items: [...tab.items, { ...newItem }] };
      });
    });
  };

  const removeItem = (idx: number) => {
    setOpciones((prev: OptionTab[]): OptionTab[] => {
      return prev.map((tab: OptionTab) => {
        if (tab.items.length <= 1) return tab;
        return { ...tab, items: tab.items.filter((_: OnlineBudgetItemLocal, i: number) => i !== idx) };
      });
    });
  };

  const addOpcion = () => {
    const srcTab = opciones[activeOpcion];
    setOpciones((prev: OptionTab[]) => {
      const idx = prev.length;
      return [
        ...prev,
        {
          nombre: `Opción ${idx + 1}`,
          items: (srcTab?.items || []).map((i: OnlineBudgetItemLocal) => ({
            ...emptyItem('LONGITUD', false),
            length: i.length,
            width: i.width,
            quantity: i.quantity,
            m2: i.m2,
          })),
          especiales: (srcTab?.especiales || []).map((e: OnlineBudgetItemLocal) => ({ ...e })),
          matEspeciales: { ...(srcTab?.matEspeciales || {}) },
        },
      ];
    });
    setActiveOpcion(opciones.length);
  };

  const removeOpcion = (idx: number) => {
    if (opciones.length <= 1) return;
    setOpciones((prev: OptionTab[]) => prev.filter((_: OptionTab, i: number) => i !== idx));
    if (activeOpcion >= idx && activeOpcion > 0) {
      setActiveOpcion((prev: number) => prev - 1);
    }
  };

  const handleDetalleChange = (idx: number, value: string, isEspecial: boolean) => {
    if (isEspecial) {
      const mat = materiales.find((m: Material) => m.name === value);
      setOpciones((prev: OptionTab[]) => {
        const next = [...prev];
        const tab = { ...next[activeOpcion] };
        const list = [...tab.especiales];
        if (mat) {
          list[idx] = { ...list[idx], material: value, currency: mat.currency || 'ARS', unitPrice: mat.currency === 'USD' ? (mat.price_usd || 0) : (mat.base_price || 0) };
          const m2 = list[idx].m2 || 0;
          const cant = Number(list[idx].quantity) || 1;
          const pu = Number(list[idx].unitPrice) || 0;
          if (!list[idx].isUnit && m2 > 0) {
            list[idx] = { ...list[idx], subtotal: Math.round(m2 * cant * pu * 100) / 100 };
          }
        }
        const matEsp = mat ? { ...tab.matEspeciales, [idx]: value } : tab.matEspeciales;
        next[activeOpcion] = { ...tab, especiales: list, matEspeciales: matEsp };
        return next;
      });
      return;
    }

    setOpciones((prev: OptionTab[]) => {
      const next = [...prev];
      const tab = { ...next[activeOpcion] };
      const items = [...tab.items];
      const mat = materiales.find((m: Material) => m.name === value);
      if (mat) {
        items[idx] = { ...items[idx], detail: value, currency: mat.currency || 'ARS', unitPrice: mat.currency === 'USD' ? (mat.price_usd || 0) : (mat.base_price || 0),  material: mat.name };
        const m2 = items[idx].m2 || 0;
        const cant = Number(items[idx].quantity) || 1;
        const pu = Number(items[idx].unitPrice) || 0;
        if (!items[idx].isUnit && m2 > 0) {
          items[idx].subtotal = Math.round(m2 * cant * pu * 100) / 100;
        }
      } else {
        items[idx] = { ...items[idx], detail: 'LONGITUD', currency: 'ARS', unitPrice: 0, material: '' };
      }
      next[activeOpcion] = { ...tab, items };
      return next;
    });
  };

  const addEspecial = () => {
    if (!nuevoEspecial) return;
    const tipo = SPECIAL_TYPES.find((t) => t.detail === nuevoEspecial);
    if (!tipo) return;
    setOpciones((prev: OptionTab[]) => {
      const next = [...prev];
      const tab = { ...next[activeOpcion] };
      next[activeOpcion] = { ...tab, especiales: [...tab.especiales, emptyItem(tipo.detail, tipo.isUnit)] };
      return next;
    });
    setNuevoEspecial('');
  };

  const removeEspecial = (idx: number) => {
    setOpciones((prev: OptionTab[]) => {
      const next = [...prev];
      const tab = { ...next[activeOpcion] };
      if (tab.especiales.length <= 1 && tab.especiales[0].detail === 'ZOCALOS') return prev;
      const list = tab.especiales.filter((_: OnlineBudgetItemLocal, i: number) => i !== idx);
      const newMatEsp: Record<number, string> = {};
      Object.entries(tab.matEspeciales).forEach(([key, val]: [string, string]) => {
        const ki = Number(key);
        if (ki < idx) newMatEsp[ki] = val;
        else if (ki > idx) newMatEsp[ki - 1] = val;
      });
      next[activeOpcion] = { ...tab, especiales: list, matEspeciales: newMatEsp };
      return next;
    });
  };

  const updateItem = (idx: number, field: string, value: unknown, isEspecial: boolean) => {
    if (isEspecial) {
      const numericFields = ['length', 'width', 'm2', 'labor', 'quantity', 'unitPrice', 'subtotal'];
      const parsed = numericFields.includes(field) ? parseNum(value) : value;
      setOpciones((prev: OptionTab[]) => {
        const next = [...prev];
        const tab = { ...next[activeOpcion] };
        const list = [...tab.especiales];
        (list[idx] as unknown as Record<string, unknown>)[field] = parsed;

        if (field === 'length' || field === 'width' || field === 'labor') {
          const la = Number(list[idx].length) || 0;
          const an = Number(list[idx].width) || 0;
          if (list[idx].detail === 'TERMINACION') {
            const mo = Number(list[idx].labor) || 0;
            list[idx].subtotal = Math.round(la * mo * 100) / 100;
            list[idx].unitPrice = Math.round(la * mo * 100) / 100;
          } else if (!list[idx].isUnit) {
            list[idx].m2 = Math.round(la * an * 100000) / 100000;
          }
        }

        const m2 = list[idx].m2 || 0;
        const cant = Number(list[idx].quantity) || 1;
        const pu = Number(list[idx].unitPrice) || 0;
        if (list[idx].detail === 'TERMINACION') {
        } else if (list[idx].isUnit) {
          list[idx].subtotal = Math.round(cant * pu * 100) / 100;
        } else if (m2 > 0) {
          list[idx].subtotal = Math.round(m2 * cant * pu * 100) / 100;
        } else {
          list[idx].subtotal = Math.round(cant * pu * 100) / 100;
        }

        next[activeOpcion] = { ...tab, especiales: list };
        return next;
      });
      return;
    }

    updateAndSync(activeOpcion, idx, field, value);
  };

  const computeTabTotal = (tabIdx: number): { ars: number; usd: number } => {
    const tab = opciones[tabIdx];
    if (!tab) return { ars: 0, usd: 0 };
    let ars = 0, usd = 0;
    [...tab.items, ...tab.especiales].forEach((i: OnlineBudgetItemLocal) => {
      if (i.currency === 'USD') usd += i.subtotal || 0;
      else ars += i.subtotal || 0;
    });
    return { ars: Math.round(ars * 100) / 100, usd: Math.round(usd * 100) / 100 };
  };

  const renderedItems = getRenderedItems();
  const activeEsp = opciones[activeOpcion]?.especiales || [];
  const activeMatEsp = opciones[activeOpcion]?.matEspeciales || {};

  const tabClass = (isActive: boolean) =>
    isActive ? `${s['oit__tab']} ${s['oit__tab--active']}` : s['oit__tab'];
  const convertClass = (isLoading: boolean) =>
    isLoading
      ? `${s['oit__convert-btn']} ${s['oit__convert-btn--loading']}`
      : s['oit__convert-btn'];

  return (
    <div className={`card ${s['oit__card']}`}>
      <div className={s['oit__tabs']}>
        {opciones.map((tab: OptionTab, ti: number) => (
          <div key={ti} className={s['oit__tab-item']}>
            <button
              type="button"
              onClick={() => { setActiveOpcion(ti); }}
              className={tabClass(ti === activeOpcion)}
            >
              {tab.nombre}
              {opciones.length > 1 && (
                <span
                  onClick={(e: React.MouseEvent) => { e.stopPropagation(); removeOpcion(ti); }}
                  className={s['oit__tab-remove']}
                  title="Eliminar opción"
                >×</span>
              )}
            </button>
            {isEdit && (
              <button
                type="button"
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); onConvertirOpcion(ti); }}
                disabled={convertingOpcion === ti}
                title="Aprobar y convertir esta opción en Orden de Trabajo"
                className={convertClass(convertingOpcion === ti)}
              >
                {convertingOpcion === ti ? 'Convirtiendo...' : '✔ Aprobar y Convertir'}
              </button>
            )}
            {ti !== activeOpcion && (
              <div className={s['oit__tab-total']}>
                {(() => { const t = computeTabTotal(ti); const parts: string[] = []; if (t.ars > 0) parts.push(`$${t.ars.toLocaleString('es-AR')}`); if (t.usd > 0) parts.push(`USD ${t.usd.toLocaleString('es-AR')}`); return parts.join(' + '); })()}
              </div>
            )}
          </div>
        ))}
        <button type="button" onClick={addOpcion} className={s['oit__add-tab']}>
          <Plus size={14} /> Agregar opción de material
        </button>
      </div>

      <table className={s['oit__table']}>
        <thead>
          <tr className={s['oit__thead-row']}>
            <th className={thLeft}>Sector / Modelo</th>
            <th className={thCenter}>Largo</th>
            <th className={thCenter}>Ancho</th>
            <th className={thCenter}>M2/U</th>
            <th className={thCenterNarrow}>Cant.</th>
            <th className={thCenterNarrow}>Moneda</th>
            <th className={thRight}>Precio Unit.</th>
            <th className={thRight}>Subtotal</th>
            <th className={thAction}></th>
          </tr>
        </thead>
        <tbody>
          <tr className={s['oit__section-row']}>
            <td colSpan={9} className={s['oit__section-cell']}>
              PRODUCCION ESTANDAR {opciones.length > 1 && <span className={s['oit__section-name']}>— {opciones[activeOpcion]?.nombre}</span>}
            </td>
          </tr>
          {renderedItems.map((item: OnlineBudgetItemLocal, idx: number) => (
            <tr key={'i' + idx}>
              <td className={cellStyle}>
                <div className={s['oit__detail-cell']}>
                  <span className={s['oit__detail-label']}>LONGITUD :</span>
                  <select className={`${s['oit__input']} ${s['oit__input--text']} ${s['oit__input--small']}`} value={item.detail} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleDetalleChange(idx, e.target.value, false)}>
                    <option value="">-- sin material --</option>
                    {materiales.map((m: Material) => <option key={m.id} value={m.name}>{m.name}</option>)}
                  </select>
                </div>
              </td>
              <td className={cellStyle}><input type="number" step="any" className={inputRight} value={item.length || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'length', e.target.value, false)} /></td>
              <td className={cellStyle}><input type="number" step="any" className={inputRight} value={item.width || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'width', e.target.value, false)} /></td>
              <td className={`${s['oit__m2-value']}`}>{item.m2 > 0 ? item.m2.toFixed(5) : '-'}</td>
              <td className={cellStyle}><input type="number" className={inputRight} value={item.quantity} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'quantity', e.target.value, false)} min="1" /></td>
              <td className={cellStyle}>
                <select className={selectStyle} value={item.currency} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateItem(idx, 'currency', e.target.value, false)} disabled={item.detail !== 'LONGITUD' && item.detail !== ''}>
                  <option value="ARS">ARS</option><option value="USD">USD</option>
                </select>
              </td>
              <td className={cellStyle}><input type="number" step="any" className={inputRight} value={item.unitPrice || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'unitPrice', e.target.value, false)} /></td>
              <td className={item.currency === 'USD' ? subtotalUsd : s['oit__subtotal']}>
                {item.currency === 'USD' ? 'USD ' : '$ '}{(item.subtotal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </td>
              <td className={cellStyle}>
                <button type="button" onClick={() => removeItem(idx)} className={s['oit__remove-btn']} title="Eliminar">
                  <Trash2 size={13} />
                </button>
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={9} className={s['oit__add-row']}>
              <button type="button" onClick={addItem} className={`btn btn-outline ${s['oit__add-btn']}`}>
                <Plus size={12} /> Agregar otra longitud
              </button>
            </td>
          </tr>

          {opciones.length > 1 && (
            <tr className={s['oit__totals-row']}>
              <td colSpan={9} className={s['oit__totals-cell']}>
                <div className={s['oit__totals-list']}>
                  {opciones.map((tab: OptionTab, ti: number) => {
                    const t = computeTabTotal(ti);
                    return (
                      <div key={ti} className={`${s['oit__total-chip']} ${ti === activeOpcion ? s['oit__total-chip--active'] : ''}`}>
                        <span className={s['oit__total-name']}>{tab.nombre}: </span>
                        {t.ars > 0 && <span className={s['oit__total-value']}>$ {t.ars.toLocaleString('es-AR', { minimumFractionDigits: 2 })} </span>}
                        {t.usd > 0 && <span className={s['oit__total-value--usd']}>USD {t.usd.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>}
                        {t.ars === 0 && t.usd === 0 && <span className={s['oit__total-empty']}>$ 0,00</span>}
                      </div>
                    );
                  })}
                </div>
              </td>
            </tr>
          )}

          <tr className={s['oit__section-row--cuts']}>
            <td colSpan={9} className={s['oit__section-cell--cuts']}>
              CORTES Y ACCESORIOS {opciones.length > 1 && <span className={s['oit__section-name']}>— {opciones[activeOpcion]?.nombre}</span>}
            </td>
          </tr>
          {activeEsp.map((item: OnlineBudgetItemLocal, idx: number) => (
            <tr key={'e' + idx}>
              <td className={cellStyle}>
                {item.detail === 'PILETA MOD' ? (
                  <div className={s['oit__detail-cell']}>
                    <span className={s['oit__detail-label']}>PILETA MOD :</span>
                    <select className={`input ${s['oit__input']} ${s['oit__input--small']}`} value={item.pool_id || ''} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                      const pid = e.target.value;
                      const p = piletas.find((x: Pool) => x.id === Number(pid));
                      const precio = p ? (p.price || 0) : 0;
                      setOpciones((prev: OptionTab[]) => {
                        const next = [...prev];
                        const tab = { ...next[activeOpcion] };
                        const list = [...tab.especiales];
                        list[idx] = { ...list[idx], pool_id: Number(pid), currency: 'ARS', unitPrice: precio, subtotal: Math.round((Number(list[idx].quantity) || 1) * precio * 100) / 100 };
                        next[activeOpcion] = { ...tab, especiales: list };
                        return next;
                      });
                    }}>
                      <option value="">Seleccionar...</option>
                      {piletas.map((p: Pool) => (<option key={p.id} value={p.id}>{p.brand} - {p.model} (Stock: {p.quantity})</option>))}
                    </select>
                  </div>
                ) : item.detail === 'TERMINACION' ? (
                  <div className={s['oit__detail-cell--column']}>
                    <span className={s['oit__term-label']}>TERMINACION</span>
                    <input className={`${s['oit__input']} ${s['oit__input--text']} ${s['oit__input--small']}`} placeholder="Tipo de terminacion..." />
                  </div>
                ) : item.isUnit ? (
                  <span className={s['oit__detail-label--lg']}>{item.detail}</span>
                ) : (
                  <div className={s['oit__detail-cell']}>
                    <span className={s['oit__detail-label']}>{item.detail} :</span>
                    <select className={`${s['oit__input']} ${s['oit__input--text']} ${s['oit__input--small']}`} value={activeMatEsp[idx] || ''} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleDetalleChange(idx, e.target.value, true)}>
                      <option value="">-- sin material --</option>
                      {materiales.map((m: Material) => <option key={m.id} value={m.name}>{m.name}</option>)}
                    </select>
                  </div>
                )}
              </td>
              <td className={cellStyle}>
                {item.detail === 'TERMINACION' ? (
                  <input type="number" step="any" className={inputRight} value={item.length || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'length', e.target.value, true)} placeholder="Mts lineales" />
                ) : !item.isUnit && (<input type="number" step="any" className={inputRight} value={item.length || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'length', e.target.value, true)} />)}
              </td>
              <td className={cellStyle}>
                {item.detail === 'TERMINACION' ? (
                  <input type="number" step="any" className={inputRight} value={item.labor || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'labor', e.target.value, true)} placeholder="Mano de obra" />
                ) : !item.isUnit ? (<input type="number" step="any" className={inputRight} value={item.width || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'width', e.target.value, true)} placeholder="Altura" />) : null}
              </td>
              <td className={item.isUnit ? `${s['oit__m2-value']} ${s['oit__m2-value--red']}` : s['oit__m2-value']}>
                {item.detail === 'TERMINACION' ? '$' + (item.unitPrice || 0).toLocaleString('es-AR') : item.isUnit ? 'U' : (item.m2 > 0 ? item.m2.toFixed(5) : '-')}
              </td>
              <td className={cellStyle}><input type="number" className={inputRight} value={item.quantity} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'quantity', e.target.value, true)} min="1" /></td>
              <td className={cellStyle}>
                <select className={selectStyle} value={item.currency} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  const nuevoMoneda = e.target.value as 'ARS' | 'USD';
                  setOpciones((prev: OptionTab[]) => {
                    const next = [...prev];
                    const tab = { ...next[activeOpcion] };
                    const list = [...tab.especiales];
                    list[idx] = { ...list[idx], currency: nuevoMoneda };
                    if (item.detail === 'PILETA MOD' && item.pool_id) {
                      const p = piletas.find((x: Pool) => x.id === Number(item.pool_id));
                      if (p) {
                        const nuevoPrecio = nuevoMoneda === 'USD' ? (p.price_usd || 0) : (p.price || 0);
                        list[idx].unitPrice = nuevoPrecio;
                        list[idx].subtotal = Math.round((Number(list[idx].quantity) || 1) * nuevoPrecio * 100) / 100;
                      }
                    }
                    next[activeOpcion] = { ...tab, especiales: list };
                    return next;
                  });
                }} disabled={!!activeMatEsp[idx]}>
                  <option value="ARS">ARS</option><option value="USD">USD</option>
                </select>
              </td>
              <td className={cellStyle}><input type="number" step="any" className={inputRight} value={item.unitPrice || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'unitPrice', e.target.value, true)} /></td>
              <td className={item.currency === 'USD' ? subtotalUsd : s['oit__subtotal']}>
                {item.currency === 'USD' ? 'USD ' : '$ '}{(item.subtotal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </td>
              <td className={cellStyle}>
                <button type="button" onClick={() => removeEspecial(idx)} className={s['oit__remove-btn']} title="Eliminar">
                  <Trash2 size={13} />
                </button>
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={9} className={s['oit__add-especial-row']}>
              <div className={s['oit__add-especial-flex']}>
                <select className={`input ${s['oit__select--add-especial']}`} value={nuevoEspecial} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNuevoEspecial(e.target.value)}>
                  <option value="">-- Agregar corte o accesorio --</option>
                  {SPECIAL_TYPES.map((t) => <option key={t.detail} value={t.detail}>{t.detail}</option>)}
                </select>
                <button type="button" onClick={addEspecial} className={`btn btn-outline ${s['oit__add-especial-btn']}`}>
                  <Plus size={12} /> Agregar
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
