import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Material } from '../../types/material';
import type { Pool } from '../../types/poolStock';

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
  poolId: number | null;
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
  return { detail, length: 0, width: 0, m2: 0, isUnit, currency: 'ARS' as const, labor: 0, quantity: 1, unitPrice: 0, subtotal: 0, material: '', poolId: null, option: 0 };
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

  const inputStyle: React.CSSProperties = { width: '100%', padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, textAlign: 'right', boxSizing: 'border-box' };
  const inputTextStyle: React.CSSProperties = { ...inputStyle, textAlign: 'left' };
  const selectStyle: React.CSSProperties = { ...inputStyle, textAlign: 'center', cursor: 'pointer' };
  const cellStyle: React.CSSProperties = { padding: '3px 4px' };

  return (
    <div className="card" style={{ marginBottom: 16, overflowX: 'auto' } as React.CSSProperties}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' } as React.CSSProperties}>
        {opciones.map((tab: OptionTab, ti: number) => (
          <div key={ti} style={{ display: 'flex', alignItems: 'center' } as React.CSSProperties}>
            <button
              type="button"
              onClick={() => { setActiveOpcion(ti); }}
              style={{
                background: ti === activeOpcion ? '#b91c1c' : '#f1f5f9',
                color: ti === activeOpcion ? '#fff' : '#475569',
                border: ti === activeOpcion ? '1px solid #b91c1c' : '1px solid #e2e8f0',
                borderRadius: '6px 6px 0 0',
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              } as React.CSSProperties}
            >
              {tab.nombre}
              {opciones.length > 1 && (
                <span
                  onClick={(e: React.MouseEvent) => { e.stopPropagation(); removeOpcion(ti); }}
                  style={{ marginLeft: 4, color: ti === activeOpcion ? '#fca5a5' : '#94a3b8', fontSize: 14, lineHeight: 1, cursor: 'pointer' } as React.CSSProperties}
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
                style={{
                  background: convertingOpcion === ti ? '#f0fdf4' : '#f0fdf4',
                  border: '1px solid #86efac',
                  borderRadius: 4,
                  padding: '2px 6px',
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#166534',
                  cursor: convertingOpcion === ti ? 'wait' : 'pointer',
                  whiteSpace: 'nowrap',
                  marginLeft: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                } as React.CSSProperties}
              >
                {convertingOpcion === ti ? 'Convirtiendo...' : '✔ Aprobar y Convertir'}
              </button>
            )}
            {ti !== activeOpcion && (
              <div style={{ fontSize: 10, color: '#64748b', marginLeft: 4, whiteSpace: 'nowrap' } as React.CSSProperties}>
                {(() => { const t = computeTabTotal(ti); const parts: string[] = []; if (t.ars > 0) parts.push(`$${t.ars.toLocaleString('es-AR')}`); if (t.usd > 0) parts.push(`USD ${t.usd.toLocaleString('es-AR')}`); return parts.join(' + '); })()}
              </div>
            )}
          </div>
        ))}
        <button type="button" onClick={addOpcion} style={{
          background: 'none', border: '1px dashed #94a3b8', borderRadius: '6px 6px 0 0',
          padding: '6px 12px', fontSize: 12, color: '#64748b', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4,
        } as React.CSSProperties}>
          <Plus size={14} /> Agregar opción de material
        </button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 } as React.CSSProperties}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th style={{ ...cellStyle, textAlign: 'left', width: '16%' } as React.CSSProperties}>Sector / Modelo</th>
            <th style={{ ...cellStyle, textAlign: 'center', width: '8%' } as React.CSSProperties}>Largo</th>
            <th style={{ ...cellStyle, textAlign: 'center', width: '8%' } as React.CSSProperties}>Ancho</th>
            <th style={{ ...cellStyle, textAlign: 'center', width: '8%' } as React.CSSProperties}>M2/U</th>
            <th style={{ ...cellStyle, textAlign: 'center', width: '7%' } as React.CSSProperties}>Cant.</th>
            <th style={{ ...cellStyle, textAlign: 'center', width: '7%' } as React.CSSProperties}>Moneda</th>
            <th style={{ ...cellStyle, textAlign: 'right', width: '12%' } as React.CSSProperties}>Precio Unit.</th>
            <th style={{ ...cellStyle, textAlign: 'right', width: '12%' } as React.CSSProperties}>Subtotal</th>
            <th style={{ width: 26 } as React.CSSProperties}></th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ background: '#e0f2fe' }}>
            <td colSpan={9} style={{ ...cellStyle, fontWeight: 700, fontSize: 12, color: '#0369a1' } as React.CSSProperties}>
              PRODUCCION ESTANDAR {opciones.length > 1 && <span style={{ fontWeight: 400 }}>— {opciones[activeOpcion]?.nombre}</span>}
            </td>
          </tr>
          {renderedItems.map((item: OnlineBudgetItemLocal, idx: number) => (
            <tr key={'i' + idx}>
              <td style={cellStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 } as React.CSSProperties}>
                  <span style={{ fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' } as React.CSSProperties}>LONGITUD :</span>
                  <select style={{ ...inputTextStyle, flex: 1 } as React.CSSProperties} value={item.detail} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleDetalleChange(idx, e.target.value, false)}>
                    <option value="">-- sin material --</option>
                    {materiales.map((m: Material) => <option key={m.id} value={m.name}>{m.name}</option>)}
                  </select>
                </div>
              </td>
              <td style={cellStyle}><input type="number" step="any" style={inputStyle} value={item.length || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'length', e.target.value, false)} /></td>
              <td style={cellStyle}><input type="number" step="any" style={inputStyle} value={item.width || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'width', e.target.value, false)} /></td>
              <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 600 } as React.CSSProperties}>{item.m2 > 0 ? item.m2.toFixed(5) : '-'}</td>
              <td style={cellStyle}><input type="number" style={inputStyle} value={item.quantity} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'quantity', e.target.value, false)} min="1" /></td>
              <td style={cellStyle}>
                <select style={selectStyle} value={item.currency} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateItem(idx, 'currency', e.target.value, false)} disabled={item.detail !== 'LONGITUD' && item.detail !== ''}>
                  <option value="ARS">ARS</option><option value="USD">USD</option>
                </select>
              </td>
              <td style={cellStyle}><input type="number" step="any" style={inputStyle} value={item.unitPrice || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'unitPrice', e.target.value, false)} /></td>
              <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 600, color: item.currency === 'USD' ? '#059669' : '#1e293b' } as React.CSSProperties}>
                {item.currency === 'USD' ? 'USD ' : '$ '}{(item.subtotal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </td>
              <td style={cellStyle}>
                <button type="button" onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 } as React.CSSProperties} title="Eliminar">
                  <Trash2 size={13} />
                </button>
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={9} style={{ padding: '4px 0', textAlign: 'center' } as React.CSSProperties}>
              <button type="button" onClick={addItem} className="btn btn-outline" style={{ fontSize: 11, padding: '4px 12px' } as React.CSSProperties}>
                <Plus size={12} /> Agregar otra longitud
              </button>
            </td>
          </tr>

          {opciones.length > 1 && (
            <tr style={{ background: '#f0fdf4' }}>
              <td colSpan={9} style={{ padding: '6px 8px', fontSize: 11 } as React.CSSProperties}>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' } as React.CSSProperties}>
                  {opciones.map((tab: OptionTab, ti: number) => {
                    const t = computeTabTotal(ti);
                    return (
                      <div key={ti} style={{
                        padding: '4px 12px',
                        background: ti === activeOpcion ? '#dcfce7' : 'transparent',
                        borderRadius: 4,
                      } as React.CSSProperties}>
                        <span style={{ fontWeight: 700, color: '#166534' } as React.CSSProperties}>{tab.nombre}: </span>
                        {t.ars > 0 && <span style={{ color: '#1e293b', fontWeight: 600 } as React.CSSProperties}>$ {t.ars.toLocaleString('es-AR', { minimumFractionDigits: 2 })} </span>}
                        {t.usd > 0 && <span style={{ color: '#059669', fontWeight: 600 } as React.CSSProperties}>USD {t.usd.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>}
                        {t.ars === 0 && t.usd === 0 && <span style={{ color: '#94a3b8' } as React.CSSProperties}>$ 0,00</span>}
                      </div>
                    );
                  })}
                </div>
              </td>
            </tr>
          )}

          <tr style={{ background: '#fef3c7' }}>
            <td colSpan={9} style={{ ...cellStyle, fontWeight: 700, fontSize: 12, color: '#92400e' } as React.CSSProperties}>
              CORTES Y ACCESORIOS {opciones.length > 1 && <span style={{ fontWeight: 400 }}>— {opciones[activeOpcion]?.nombre}</span>}
            </td>
          </tr>
          {activeEsp.map((item: OnlineBudgetItemLocal, idx: number) => (
            <tr key={'e' + idx}>
              <td style={cellStyle}>
                {item.detail === 'PILETA MOD' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 } as React.CSSProperties}>
                    <span style={{ fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' } as React.CSSProperties}>PILETA MOD :</span>
                    <select className="input" style={{ fontSize: 11, flex: 1 } as React.CSSProperties} value={item.poolId || ''} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                      const pid = e.target.value;
                      const p = piletas.find((x: Pool) => x.id === Number(pid));
                      const precio = p ? (p.price || 0) : 0;
                      setOpciones((prev: OptionTab[]) => {
                        const next = [...prev];
                        const tab = { ...next[activeOpcion] };
                        const list = [...tab.especiales];
                        list[idx] = { ...list[idx], poolId: Number(pid), currency: 'ARS', unitPrice: precio, subtotal: Math.round((Number(list[idx].quantity) || 1) * precio * 100) / 100 };
                        next[activeOpcion] = { ...tab, especiales: list };
                        return next;
                      });
                    }}>
                      <option value="">Seleccionar...</option>
                      {piletas.map((p: Pool) => (<option key={p.id} value={p.id}>{p.brand} - {p.model} (Stock: {p.quantity})</option>))}
                    </select>
                  </div>
                ) : item.detail === 'TERMINACION' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 } as React.CSSProperties}>
                    <span style={{ fontWeight: 700, fontSize: 11 } as React.CSSProperties}>TERMINACION</span>
                    <input style={{ ...inputTextStyle, fontSize: 11 } as React.CSSProperties} placeholder="Tipo de terminacion..." />
                  </div>
                ) : item.isUnit ? (
                  <span style={{ fontWeight: 700, fontSize: 12 } as React.CSSProperties}>{item.detail}</span>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 } as React.CSSProperties}>
                    <span style={{ fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' } as React.CSSProperties}>{item.detail} :</span>
                    <select style={{ ...inputTextStyle, flex: 1 } as React.CSSProperties} value={activeMatEsp[idx] || ''} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleDetalleChange(idx, e.target.value, true)}>
                      <option value="">-- sin material --</option>
                      {materiales.map((m: Material) => <option key={m.id} value={m.name}>{m.name}</option>)}
                    </select>
                  </div>
                )}
              </td>
              <td style={cellStyle}>
                {item.detail === 'TERMINACION' ? (
                  <input type="number" step="any" style={inputStyle} value={item.length || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'length', e.target.value, true)} placeholder="Mts lineales" />
                ) : !item.isUnit && (<input type="number" step="any" style={inputStyle} value={item.length || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'length', e.target.value, true)} />)}
              </td>
              <td style={cellStyle}>
                {item.detail === 'TERMINACION' ? (
                  <input type="number" step="any" style={inputStyle} value={item.labor || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'labor', e.target.value, true)} placeholder="Mano de obra" />
                ) : !item.isUnit ? (<input type="number" step="any" style={inputStyle} value={item.width || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'width', e.target.value, true)} placeholder="Altura" />) : null}
              </td>
              <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 600, color: item.isUnit ? '#b91c1c' : '#1e293b' } as React.CSSProperties}>
                {item.detail === 'TERMINACION' ? '$' + (item.unitPrice || 0).toLocaleString('es-AR') : item.isUnit ? 'U' : (item.m2 > 0 ? item.m2.toFixed(5) : '-')}
              </td>
              <td style={cellStyle}><input type="number" style={inputStyle} value={item.quantity} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'quantity', e.target.value, true)} min="1" /></td>
              <td style={cellStyle}>
                <select style={selectStyle} value={item.currency} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  const nuevoMoneda = e.target.value as 'ARS' | 'USD';
                  setOpciones((prev: OptionTab[]) => {
                    const next = [...prev];
                    const tab = { ...next[activeOpcion] };
                    const list = [...tab.especiales];
                    list[idx] = { ...list[idx], currency: nuevoMoneda };
                    if (item.detail === 'PILETA MOD' && item.poolId) {
                      const p = piletas.find((x: Pool) => x.id === Number(item.poolId));
                      if (p) {
                        const nuevoPrecio = nuevoMoneda === 'USD' ? (p.priceUsd || 0) : (p.price || 0);
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
              <td style={cellStyle}><input type="number" step="any" style={inputStyle} value={item.unitPrice || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'unitPrice', e.target.value, true)} /></td>
              <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 600, color: item.currency === 'USD' ? '#059669' : '#1e293b' } as React.CSSProperties}>
                {item.currency === 'USD' ? 'USD ' : '$ '}{(item.subtotal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </td>
              <td style={cellStyle}>
                <button type="button" onClick={() => removeEspecial(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 } as React.CSSProperties} title="Eliminar">
                  <Trash2 size={13} />
                </button>
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={9} style={{ padding: '4px 0' } as React.CSSProperties}>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' } as React.CSSProperties}>
                <select className="input" style={{ width: 200, fontSize: 11 } as React.CSSProperties} value={nuevoEspecial} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNuevoEspecial(e.target.value)}>
                  <option value="">-- Agregar corte o accesorio --</option>
                  {SPECIAL_TYPES.map((t) => <option key={t.detail} value={t.detail}>{t.detail}</option>)}
                </select>
                <button type="button" onClick={addEspecial} className="btn btn-outline" style={{ fontSize: 11, padding: '4px 12px' } as React.CSSProperties}>
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
