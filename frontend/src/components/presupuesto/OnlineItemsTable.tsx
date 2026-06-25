import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Material } from '../../types/material';
import type { StockPileta } from '../../types/stockPileta';

export interface PresupuestoOnlineItemLocal {
  detalle: string;
  largo: number;
  ancho: number;
  m2: number;
  es_unidad: boolean;
  moneda: 'ARS' | 'USD';
  mano_de_obra: number;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  material: string;
  pileta_id: number | null;
  opcion: number;
}

export interface OpcionTab {
  nombre: string;
  items: PresupuestoOnlineItemLocal[];
  especiales: PresupuestoOnlineItemLocal[];
  matEspeciales: Record<number, string>;
}

export const FILAS_INICIALES = Array.from({ length: 3 }, (): Partial<PresupuestoOnlineItemLocal> => ({ detalle: 'LONGITUD', es_unidad: false }));
export const ESPECIALES_INICIALES = [{ detalle: 'ZOCALOS', es_unidad: false }] as const;
export const TIPOS_ESPECIALES: { detalle: string; es_unidad: boolean }[] = [
  { detalle: 'ZOCALOS', es_unidad: false },
  { detalle: 'APERTURA + PEGADO PILETA', es_unidad: true },
  { detalle: 'APERTURA PILETA APOYO', es_unidad: true },
  { detalle: 'MENSULAS', es_unidad: true },
  { detalle: 'APERTURA ANAFE', es_unidad: true },
  { detalle: 'TERMINACION', es_unidad: true },
  { detalle: 'PILETA MOD', es_unidad: true },
];
export const NOMBRES_ESPECIALES = new Set(TIPOS_ESPECIALES.map((t) => t.detalle));

export function emptyItem(detalle: string = 'LONGITUD', es_unidad: boolean = false): PresupuestoOnlineItemLocal {
  return { detalle, largo: 0, ancho: 0, m2: 0, es_unidad, moneda: 'ARS' as const, mano_de_obra: 0, cantidad: 1, precio_unitario: 0, subtotal: 0, material: '', pileta_id: null, opcion: 0 };
}

export function parseNum(v: unknown): number {
  return v === '' || v === null || v === undefined ? 0 : Number(v);
}

export function createOpcion(): OpcionTab {
  return {
    nombre: 'Opción 1',
    items: FILAS_INICIALES.map((f) => emptyItem(f.detalle, f.es_unidad)),
    especiales: ESPECIALES_INICIALES.map((e) => emptyItem(e.detalle, e.es_unidad)),
    matEspeciales: {},
  };
}

interface Props {
  opciones: OpcionTab[];
  setOpciones: React.Dispatch<React.SetStateAction<OpcionTab[]>>;
  activeOpcion: number;
  setActiveOpcion: React.Dispatch<React.SetStateAction<number>>;
  materiales: Material[];
  piletas: StockPileta[];
  isEdit: boolean;
  convertingOpcion: number | null;
  onConvertirOpcion: (opcionIdx: number) => void;
}

export default function OnlineItemsTable({
  opciones, setOpciones, activeOpcion, setActiveOpcion,
  materiales, piletas, isEdit, convertingOpcion, onConvertirOpcion,
}: Props) {
  const [nuevoEspecial, setNuevoEspecial] = useState<string>('');

  const getRenderedItems = (): PresupuestoOnlineItemLocal[] => {
    return opciones[activeOpcion]?.items || [];
  };

  const updateAndSync = (tabIdx: number, itemIdx: number, field: string, value: unknown) => {
    const numericFields = ['largo', 'ancho', 'm2', 'mano_de_obra', 'cantidad', 'precio_unitario', 'subtotal'];
    const parsed = numericFields.includes(field) ? parseNum(value) : value;
    const measureFields = ['largo', 'ancho', 'cantidad'];

    setOpciones((prev: OpcionTab[]) => {
      const next = prev.map((tab: OpcionTab, ti: number) => {
        const items = [...tab.items];
        if (!items[itemIdx]) return tab;
        const updated = { ...items[itemIdx], [field]: parsed } as PresupuestoOnlineItemLocal;
        items[itemIdx] = updated;

        if (field === 'largo' || field === 'ancho' || field === 'mano_de_obra') {
          const la = Number(updated.largo) || 0;
          const an = Number(updated.ancho) || 0;
          if (updated.detalle === 'TERMINACION') {
            const mo = Number(updated.mano_de_obra) || 0;
            updated.subtotal = Math.round(la * mo * 100) / 100;
            updated.precio_unitario = Math.round(la * mo * 100) / 100;
          } else if (!updated.es_unidad) {
            updated.m2 = Math.round(la * an * 100000) / 100000;
          }
        }

        if (!measureFields.includes(field) || ti === tabIdx) {
          const m2 = updated.m2 || 0;
          const cant = Number(updated.cantidad) || 1;
          const pu = Number(updated.precio_unitario) || 0;
          if (updated.detalle === 'TERMINACION') {
          } else if (updated.es_unidad) {
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
          const medidas = srcTab.items.map((i: PresupuestoOnlineItemLocal) => ({ largo: i.largo, ancho: i.ancho, cantidad: i.cantidad }));
          for (let ti = 0; ti < next.length; ti++) {
            if (ti === tabIdx) continue;
            const tabItems = [...next[ti].items];
            for (let ii = 0; ii < tabItems.length && ii < medidas.length; ii++) {
              const m = medidas[ii];
              const prevItem = prev[ti]?.items[ii] || tabItems[ii];
              const m2 = Math.round((m.largo || 0) * (m.ancho || 0) * 100000) / 100000;
              const pu = Number(prevItem.precio_unitario) || 0;
              const cant = m.cantidad || 1;
              let subtotal = 0;
              if (prevItem.detalle === 'TERMINACION') {
                subtotal = Math.round((m.largo || 0) * (prevItem.mano_de_obra || 0) * 100) / 100;
              } else if (prevItem.es_unidad) {
                subtotal = Math.round(cant * pu * 100) / 100;
              } else if (m2 > 0) {
                subtotal = Math.round(m2 * cant * pu * 100) / 100;
              } else {
                subtotal = Math.round(cant * pu * 100) / 100;
              }
              tabItems[ii] = {
                ...tabItems[ii],
                largo: m.largo,
                ancho: m.ancho,
                cantidad: m.cantidad,
                m2,
                subtotal,
              } as PresupuestoOnlineItemLocal;
            }
            next[ti] = { ...next[ti], items: tabItems };
          }
        }
      }

      return next;
    });
  };

  const addItem = () => {
    setOpciones((prev: OpcionTab[]) => {
      const newItem = emptyItem('LONGITUD', false);
      return prev.map((tab: OpcionTab) => {
        return { ...tab, items: [...tab.items, { ...newItem }] };
      });
    });
  };

  const removeItem = (idx: number) => {
    setOpciones((prev: OpcionTab[]): OpcionTab[] => {
      return prev.map((tab: OpcionTab) => {
        if (tab.items.length <= 1) return tab;
        return { ...tab, items: tab.items.filter((_: PresupuestoOnlineItemLocal, i: number) => i !== idx) };
      });
    });
  };

  const addOpcion = () => {
    const srcTab = opciones[activeOpcion];
    setOpciones((prev: OpcionTab[]) => {
      const idx = prev.length;
      return [
        ...prev,
        {
          nombre: `Opción ${idx + 1}`,
          items: (srcTab?.items || []).map((i: PresupuestoOnlineItemLocal) => ({
            ...emptyItem('LONGITUD', false),
            largo: i.largo,
            ancho: i.ancho,
            cantidad: i.cantidad,
            m2: i.m2,
          })),
          especiales: (srcTab?.especiales || []).map((e: PresupuestoOnlineItemLocal) => ({ ...e })),
          matEspeciales: { ...(srcTab?.matEspeciales || {}) },
        },
      ];
    });
    setActiveOpcion(opciones.length);
  };

  const removeOpcion = (idx: number) => {
    if (opciones.length <= 1) return;
    setOpciones((prev: OpcionTab[]) => prev.filter((_: OpcionTab, i: number) => i !== idx));
    if (activeOpcion >= idx && activeOpcion > 0) {
      setActiveOpcion((prev: number) => prev - 1);
    }
  };

  const handleDetalleChange = (idx: number, value: string, isEspecial: boolean) => {
    if (isEspecial) {
      const mat = materiales.find((m: Material) => m.nombre === value);
      setOpciones((prev: OpcionTab[]) => {
        const next = [...prev];
        const tab = { ...next[activeOpcion] };
        const list = [...tab.especiales];
        if (mat) {
          list[idx] = { ...list[idx], material: value, moneda: mat.moneda || 'ARS', precio_unitario: mat.moneda === 'USD' ? (mat.precio_m2_usd || 0) : (mat.precio_m2 || 0) };
          const m2 = list[idx].m2 || 0;
          const cant = Number(list[idx].cantidad) || 1;
          const pu = Number(list[idx].precio_unitario) || 0;
          if (!list[idx].es_unidad && m2 > 0) {
            list[idx] = { ...list[idx], subtotal: Math.round(m2 * cant * pu * 100) / 100 };
          }
        }
        const matEsp = mat ? { ...tab.matEspeciales, [idx]: value } : tab.matEspeciales;
        next[activeOpcion] = { ...tab, especiales: list, matEspeciales: matEsp };
        return next;
      });
      return;
    }

    setOpciones((prev: OpcionTab[]) => {
      const next = [...prev];
      const tab = { ...next[activeOpcion] };
      const items = [...tab.items];
      const mat = materiales.find((m: Material) => m.nombre === value);
      if (mat) {
        items[idx] = { ...items[idx], detalle: value, moneda: mat.moneda || 'ARS', precio_unitario: mat.moneda === 'USD' ? (mat.precio_m2_usd || 0) : (mat.precio_m2 || 0), material: mat.nombre };
        const m2 = items[idx].m2 || 0;
        const cant = Number(items[idx].cantidad) || 1;
        const pu = Number(items[idx].precio_unitario) || 0;
        if (!items[idx].es_unidad && m2 > 0) {
          items[idx].subtotal = Math.round(m2 * cant * pu * 100) / 100;
        }
      } else {
        items[idx] = { ...items[idx], detalle: 'LONGITUD', moneda: 'ARS', precio_unitario: 0, material: '' };
      }
      next[activeOpcion] = { ...tab, items };
      return next;
    });
  };

  const addEspecial = () => {
    if (!nuevoEspecial) return;
    const tipo = TIPOS_ESPECIALES.find((t) => t.detalle === nuevoEspecial);
    if (!tipo) return;
    setOpciones((prev: OpcionTab[]) => {
      const next = [...prev];
      const tab = { ...next[activeOpcion] };
      next[activeOpcion] = { ...tab, especiales: [...tab.especiales, emptyItem(tipo.detalle, tipo.es_unidad)] };
      return next;
    });
    setNuevoEspecial('');
  };

  const removeEspecial = (idx: number) => {
    setOpciones((prev: OpcionTab[]) => {
      const next = [...prev];
      const tab = { ...next[activeOpcion] };
      if (tab.especiales.length <= 1 && tab.especiales[0].detalle === 'ZOCALOS') return prev;
      const list = tab.especiales.filter((_: PresupuestoOnlineItemLocal, i: number) => i !== idx);
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
      const numericFields = ['largo', 'ancho', 'm2', 'mano_de_obra', 'cantidad', 'precio_unitario', 'subtotal'];
      const parsed = numericFields.includes(field) ? parseNum(value) : value;
      setOpciones((prev: OpcionTab[]) => {
        const next = [...prev];
        const tab = { ...next[activeOpcion] };
        const list = [...tab.especiales];
        (list[idx] as unknown as Record<string, unknown>)[field] = parsed;

        if (field === 'largo' || field === 'ancho' || field === 'mano_de_obra') {
          const la = Number(list[idx].largo) || 0;
          const an = Number(list[idx].ancho) || 0;
          if (list[idx].detalle === 'TERMINACION') {
            const mo = Number(list[idx].mano_de_obra) || 0;
            list[idx].subtotal = Math.round(la * mo * 100) / 100;
            list[idx].precio_unitario = Math.round(la * mo * 100) / 100;
          } else if (!list[idx].es_unidad) {
            list[idx].m2 = Math.round(la * an * 100000) / 100000;
          }
        }

        const m2 = list[idx].m2 || 0;
        const cant = Number(list[idx].cantidad) || 1;
        const pu = Number(list[idx].precio_unitario) || 0;
        if (list[idx].detalle === 'TERMINACION') {
        } else if (list[idx].es_unidad) {
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
    [...tab.items, ...tab.especiales].forEach((i: PresupuestoOnlineItemLocal) => {
      if (i.moneda === 'USD') usd += i.subtotal || 0;
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
        {opciones.map((tab: OpcionTab, ti: number) => (
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
          {renderedItems.map((item: PresupuestoOnlineItemLocal, idx: number) => (
            <tr key={'i' + idx}>
              <td style={cellStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 } as React.CSSProperties}>
                  <span style={{ fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' } as React.CSSProperties}>LONGITUD :</span>
                  <select style={{ ...inputTextStyle, flex: 1 } as React.CSSProperties} value={item.detalle} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleDetalleChange(idx, e.target.value, false)}>
                    <option value="">-- sin material --</option>
                    {materiales.map((m: Material) => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
                  </select>
                </div>
              </td>
              <td style={cellStyle}><input type="number" step="any" style={inputStyle} value={item.largo || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'largo', e.target.value, false)} /></td>
              <td style={cellStyle}><input type="number" step="any" style={inputStyle} value={item.ancho || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'ancho', e.target.value, false)} /></td>
              <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 600 } as React.CSSProperties}>{item.m2 > 0 ? item.m2.toFixed(5) : '-'}</td>
              <td style={cellStyle}><input type="number" style={inputStyle} value={item.cantidad} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'cantidad', e.target.value, false)} min="1" /></td>
              <td style={cellStyle}>
                <select style={selectStyle} value={item.moneda} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateItem(idx, 'moneda', e.target.value, false)} disabled={item.detalle !== 'LONGITUD' && item.detalle !== ''}>
                  <option value="ARS">ARS</option><option value="USD">USD</option>
                </select>
              </td>
              <td style={cellStyle}><input type="number" step="any" style={inputStyle} value={item.precio_unitario || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'precio_unitario', e.target.value, false)} /></td>
              <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 600, color: item.moneda === 'USD' ? '#059669' : '#1e293b' } as React.CSSProperties}>
                {item.moneda === 'USD' ? 'USD ' : '$ '}{(item.subtotal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
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
                  {opciones.map((tab: OpcionTab, ti: number) => {
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
          {activeEsp.map((item: PresupuestoOnlineItemLocal, idx: number) => (
            <tr key={'e' + idx}>
              <td style={cellStyle}>
                {item.detalle === 'PILETA MOD' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 } as React.CSSProperties}>
                    <span style={{ fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' } as React.CSSProperties}>PILETA MOD :</span>
                    <select className="input" style={{ fontSize: 11, flex: 1 } as React.CSSProperties} value={item.pileta_id || ''} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                      const pid = e.target.value;
                      const p = piletas.find((x: StockPileta) => x.id === Number(pid));
                      const precio = p ? (p.precio || 0) : 0;
                      setOpciones((prev: OpcionTab[]) => {
                        const next = [...prev];
                        const tab = { ...next[activeOpcion] };
                        const list = [...tab.especiales];
                        list[idx] = { ...list[idx], pileta_id: Number(pid), moneda: 'ARS', precio_unitario: precio, subtotal: Math.round((Number(list[idx].cantidad) || 1) * precio * 100) / 100 };
                        next[activeOpcion] = { ...tab, especiales: list };
                        return next;
                      });
                    }}>
                      <option value="">Seleccionar...</option>
                      {piletas.map((p: StockPileta) => (<option key={p.id} value={p.id}>{p.marca} - {p.modelo} (Stock: {p.cantidad})</option>))}
                    </select>
                  </div>
                ) : item.detalle === 'TERMINACION' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 } as React.CSSProperties}>
                    <span style={{ fontWeight: 700, fontSize: 11 } as React.CSSProperties}>TERMINACION</span>
                    <input style={{ ...inputTextStyle, fontSize: 11 } as React.CSSProperties} placeholder="Tipo de terminacion..." />
                  </div>
                ) : item.es_unidad ? (
                  <span style={{ fontWeight: 700, fontSize: 12 } as React.CSSProperties}>{item.detalle}</span>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 } as React.CSSProperties}>
                    <span style={{ fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' } as React.CSSProperties}>{item.detalle} :</span>
                    <select style={{ ...inputTextStyle, flex: 1 } as React.CSSProperties} value={activeMatEsp[idx] || ''} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleDetalleChange(idx, e.target.value, true)}>
                      <option value="">-- sin material --</option>
                      {materiales.map((m: Material) => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
                    </select>
                  </div>
                )}
              </td>
              <td style={cellStyle}>
                {item.detalle === 'TERMINACION' ? (
                  <input type="number" step="any" style={inputStyle} value={item.largo || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'largo', e.target.value, true)} placeholder="Mts lineales" />
                ) : !item.es_unidad && (<input type="number" step="any" style={inputStyle} value={item.largo || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'largo', e.target.value, true)} />)}
              </td>
              <td style={cellStyle}>
                {item.detalle === 'TERMINACION' ? (
                  <input type="number" step="any" style={inputStyle} value={item.mano_de_obra || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'mano_de_obra', e.target.value, true)} placeholder="Mano de obra" />
                ) : !item.es_unidad ? (<input type="number" step="any" style={inputStyle} value={item.ancho || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'ancho', e.target.value, true)} placeholder="Altura" />) : null}
              </td>
              <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 600, color: item.es_unidad ? '#b91c1c' : '#1e293b' } as React.CSSProperties}>
                {item.detalle === 'TERMINACION' ? '$' + (item.precio_unitario || 0).toLocaleString('es-AR') : item.es_unidad ? 'U' : (item.m2 > 0 ? item.m2.toFixed(5) : '-')}
              </td>
              <td style={cellStyle}><input type="number" style={inputStyle} value={item.cantidad} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'cantidad', e.target.value, true)} min="1" /></td>
              <td style={cellStyle}>
                <select style={selectStyle} value={item.moneda} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  const nuevoMoneda = e.target.value as 'ARS' | 'USD';
                  setOpciones((prev: OpcionTab[]) => {
                    const next = [...prev];
                    const tab = { ...next[activeOpcion] };
                    const list = [...tab.especiales];
                    list[idx] = { ...list[idx], moneda: nuevoMoneda };
                    if (item.detalle === 'PILETA MOD' && item.pileta_id) {
                      const p = piletas.find((x: StockPileta) => x.id === Number(item.pileta_id));
                      if (p) {
                        const nuevoPrecio = nuevoMoneda === 'USD' ? (p.precio_usd || 0) : (p.precio || 0);
                        list[idx].precio_unitario = nuevoPrecio;
                        list[idx].subtotal = Math.round((Number(list[idx].cantidad) || 1) * nuevoPrecio * 100) / 100;
                      }
                    }
                    next[activeOpcion] = { ...tab, especiales: list };
                    return next;
                  });
                }} disabled={!!activeMatEsp[idx]}>
                  <option value="ARS">ARS</option><option value="USD">USD</option>
                </select>
              </td>
              <td style={cellStyle}><input type="number" step="any" style={inputStyle} value={item.precio_unitario || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'precio_unitario', e.target.value, true)} /></td>
              <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 600, color: item.moneda === 'USD' ? '#059669' : '#1e293b' } as React.CSSProperties}>
                {item.moneda === 'USD' ? 'USD ' : '$ '}{(item.subtotal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
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
                  {TIPOS_ESPECIALES.map((t) => <option key={t.detalle} value={t.detalle}>{t.detalle}</option>)}
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
