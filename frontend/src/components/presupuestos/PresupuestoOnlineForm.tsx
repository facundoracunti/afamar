import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Plus, Trash2, FileOutput } from 'lucide-react';
import { getPresupuestoOnline, createPresupuestoOnline, updatePresupuestoOnline, getMateriales, getPiletas, getNextPresupuestoNumero, convertirOnlineAOrden } from '../../services/api';
import Loading from '../common/Loading';

const FILAS_INICIALES = Array.from({ length: 3 }, () => ({ detalle: 'LONGITUD', es_unidad: false }));
const ESPECIALES_INICIALES = [{ detalle: 'ZOCALOS', es_unidad: false }];
const TIPOS_ESPECIALES = [
  { detalle: 'ZOCALOS', es_unidad: false },
  { detalle: 'APERTURA + PEGADO PILETA', es_unidad: true },
  { detalle: 'APERTURA PILETA APOYO', es_unidad: true },
  { detalle: 'MENSULAS', es_unidad: true },
  { detalle: 'APERTURA ANAFE', es_unidad: true },
  { detalle: 'TERMINACION', es_unidad: true },
  { detalle: 'PILETA MOD', es_unidad: true },
];
const NOMBRES_ESPECIALES = new Set(TIPOS_ESPECIALES.map((t) => t.detalle));

function emptyItem(detalle = 'LONGITUD', es_unidad = false) {
  return { detalle, largo: 0, ancho: 0, m2: 0, es_unidad, moneda: 'ARS', mano_de_obra: 0, cantidad: 1, precio_unitario: 0, subtotal: 0, material: '', pileta_id: null };
}

export default function PresupuestoOnlineForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [opciones, setOpciones] = useState([
    { nombre: 'Opción 1', items: FILAS_INICIALES.map((f) => emptyItem(f.detalle, f.es_unidad)) },
  ]);
  const [activeOpcion, setActiveOpcion] = useState(0);

  const [especiales, setEspeciales] = useState(ESPECIALES_INICIALES.map((e) => emptyItem(e.detalle, e.es_unidad)));
  const [nuevoEspecial, setNuevoEspecial] = useState('');
  const [matEspeciales, setMatEspeciales] = useState({});
  const [cliente, setCliente] = useState('');
  const [telefono, setTelefono] = useState('');
  const [tipoObra, setTipoObra] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [dolarDia, setDolarDia] = useState(1000);
  const [totalArs, setTotalArs] = useState(0);
  const [totalUsd, setTotalUsd] = useState(0);
  const [totalConsolidado, setTotalConsolidado] = useState(0);
  const [materiales, setMateriales] = useState([]);
  const [piletas, setPiletas] = useState([]);
  const [numero, setNumero] = useState('');

  useEffect(() => { getMateriales({ limit: 500 }).then((r) => setMateriales(r.data)); }, []);
  useEffect(() => { getPiletas().then((r) => setPiletas(r.data)); }, []);
  useEffect(() => {
    if (!isEdit) { getNextPresupuestoNumero().then((r) => setNumero(r.data.numero)).catch(() => {}); }
  }, [isEdit]);

  const recalcFrom = (items, especialesList, ddOverride) => {
    let ars = 0, usd = 0;
    [...items, ...(especialesList || especiales)].forEach((i) => {
      if (i.moneda === 'USD') usd += i.subtotal || 0;
      else ars += i.subtotal || 0;
    });
    setTotalArs(Math.round(ars * 100) / 100);
    setTotalUsd(Math.round(usd * 100) / 100);
    const dd = ddOverride !== undefined ? ddOverride : Number(dolarDia);
    setTotalConsolidado(Math.round((ars + usd * dd) * 100) / 100);
  };

  const getRenderedItems = () => {
    return opciones[activeOpcion]?.items || [];
  };

  useEffect(() => {
    if (isEdit) {
      getPresupuestoOnline(id).then((res) => {
        const d = res.data;
        setCliente(d.cliente || '');
        setTelefono(d.telefono || '');
        setTipoObra(d.tipo_obra || '');
        setFecha(d.fecha || new Date().toISOString().slice(0, 10));
        setDolarDia(d.dolar_dia ?? 1000);
        setNumero(d.numero || '');
        const toNum = (v) => v === '' || v === null || v === undefined ? 0 : Number(v);
        if (d.items?.length) {
          const normales = d.items.filter((i) => !i.es_unidad && !NOMBRES_ESPECIALES.has(i.detalle));
          const esp = d.items.filter((i) => i.es_unidad || NOMBRES_ESPECIALES.has(i.detalle)).map((i) => {
            const e = { ...i, largo: toNum(i.largo), ancho: toNum(i.ancho), m2: toNum(i.m2), cantidad: Math.max(1, toNum(i.cantidad)), precio_unitario: toNum(i.precio_unitario), subtotal: toNum(i.subtotal), mano_de_obra: toNum(i.mano_de_obra) };
            if (e.detalle === 'PILETA MOD' && !e.pileta_id && d.pileta_id) e.pileta_id = Number(d.pileta_id);
            return e;
          });
          setEspeciales(esp.length ? esp : ESPECIALES_INICIALES.map((e) => emptyItem(e.detalle, e.es_unidad)));
          const matEsp = {};
          esp.forEach((e, i) => { if (e.material) matEsp[i] = e.material; });
          setMatEspeciales(matEsp);

          const opcionMap = {};
          normales.forEach((i) => {
            const op = i.opcion ?? 0;
            if (!opcionMap[op]) opcionMap[op] = [];
            opcionMap[op].push({ ...i, largo: toNum(i.largo), ancho: toNum(i.ancho), m2: toNum(i.m2), cantidad: Math.max(1, toNum(i.cantidad)), precio_unitario: toNum(i.precio_unitario), subtotal: toNum(i.subtotal), mano_de_obra: toNum(i.mano_de_obra) });
          });
          const opcionKeys = Object.keys(opcionMap).sort((a, b) => Number(a) - Number(b));
          if (opcionKeys.length > 0) {
            setOpciones(opcionKeys.map((key, idx) => ({
              nombre: `Opción ${idx + 1}`,
              items: opcionMap[key],
            })));
          } else {
            setOpciones([{ nombre: 'Opción 1', items: FILAS_INICIALES.map((f) => emptyItem(f.detalle, f.es_unidad)) }]);
          }

          const allItems = Object.values(opcionMap).flat();
          recalcFrom(allItems, esp, d.dolar_dia ?? 1000);
        }
        setLoading(false);
      }).catch((err) => {
        console.error('Error al cargar presupuesto online', err);
        alert('Error al cargar el presupuesto');
        setLoading(false);
      });
    }
  }, [id, isEdit]);

  const updateAndSync = (tabIdx, itemIdx, field, value) => {
    const num = (v) => v === '' || v === null || v === undefined ? 0 : Number(v);
    const numericFields = ['largo', 'ancho', 'm2', 'mano_de_obra', 'cantidad', 'precio_unitario', 'subtotal'];
    const parsed = numericFields.includes(field) ? num(value) : value;
    const measureFields = ['largo', 'ancho', 'cantidad'];

    let nextTabItems = null;
    setOpciones((prev) => {
      const next = prev.map((tab, ti) => {
        const items = [...tab.items];
        if (!items[itemIdx]) return tab;
        items[itemIdx] = { ...items[itemIdx], [field]: parsed };

        if (field === 'largo' || field === 'ancho' || field === 'mano_de_obra') {
          const la = Number(items[itemIdx].largo) || 0;
          const an = Number(items[itemIdx].ancho) || 0;
          if (items[itemIdx].detalle === 'TERMINACION') {
            const mo = Number(items[itemIdx].mano_de_obra) || 0;
            items[itemIdx].subtotal = Math.round(la * mo * 100) / 100;
            items[itemIdx].precio_unitario = Math.round(la * mo * 100) / 100;
          } else if (!items[itemIdx].es_unidad) {
            items[itemIdx].m2 = Math.round(la * an * 100000) / 100000;
          }
        }

        if (!measureFields.includes(field) || ti === tabIdx) {
          const m2 = items[itemIdx].m2 || 0;
          const cant = Number(items[itemIdx].cantidad) || 1;
          const pu = Number(items[itemIdx].precio_unitario) || 0;
          if (items[itemIdx].detalle === 'TERMINACION') {
          } else if (items[itemIdx].es_unidad) {
            items[itemIdx].subtotal = Math.round(cant * pu * 100) / 100;
          } else if (m2 > 0) {
            items[itemIdx].subtotal = Math.round(m2 * cant * pu * 100) / 100;
          } else {
            items[itemIdx].subtotal = Math.round(cant * pu * 100) / 100;
          }
        }

        return { ...tab, items };
      });

      if (measureFields.includes(field)) {
        const srcTab = next[tabIdx];
        if (srcTab) {
          const medidas = srcTab.items.map((i) => ({ largo: i.largo, ancho: i.ancho, cantidad: i.cantidad }));
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
              };
            }
            next[ti] = { ...next[ti], items: tabItems };
          }
        }
      }

      if (next[tabIdx]) nextTabItems = [...next[tabIdx].items];
      return next;
    });

    if (nextTabItems) recalcFrom(nextTabItems, especiales);
  };

  const addItem = () => {
    setOpciones((prev) => {
      const newItem = emptyItem('LONGITUD', false);
      return prev.map((tab, ti) => {
        if (ti === activeOpcion) {
          return { ...tab, items: [...tab.items, { ...newItem }] };
        }
        return { ...tab, items: [...tab.items, { ...newItem }] };
      });
    });
  };

  const removeItem = (idx) => {
    let computedItems = null;
    setOpciones((prev) => {
      const next = prev.map((tab) => {
        if (tab.items.length <= 1) return tab;
        return { ...tab, items: tab.items.filter((_, i) => i !== idx) };
      });
      if (next[activeOpcion]) computedItems = [...next[activeOpcion].items];
      return next;
    });
    if (computedItems && computedItems.length > 0) {
      recalcFrom(computedItems, especiales);
    }
  };

  const addOpcion = () => {
    const currentItems = getRenderedItems();
    setOpciones((prev) => {
      const idx = prev.length;
      setActiveOpcion(idx);
      return [
        ...prev,
        {
          nombre: `Opción ${idx + 1}`,
          items: currentItems.map((i) => ({
            ...emptyItem('LONGITUD', false),
            largo: i.largo,
            ancho: i.ancho,
            cantidad: i.cantidad,
            m2: i.m2,
          })),
        },
      ];
    });
  };

  const removeOpcion = (idx) => {
    if (opciones.length <= 1) return;
    setOpciones((prev) => prev.filter((_, i) => i !== idx));
    if (activeOpcion >= idx && activeOpcion > 0) {
      setActiveOpcion((prev) => prev - 1);
    }
  };

  const handleDetalleChange = (idx, value, isEspecial) => {
    if (isEspecial) {
      const mat = materiales.find((m) => m.nombre === value);
      const list = [...especiales];
      if (mat) {
        list[idx].material = value;
        list[idx].moneda = mat.moneda || 'ARS';
        list[idx].precio_unitario = mat.moneda === 'USD' ? (mat.precio_m2_usd || 0) : (mat.precio_m2 || 0);
        const m2 = list[idx].m2 || 0;
        const cant = Number(list[idx].cantidad) || 1;
        const pu = Number(list[idx].precio_unitario) || 0;
        if (!list[idx].es_unidad && m2 > 0) {
          list[idx].subtotal = Math.round(m2 * cant * pu * 100) / 100;
        }
      }
      setEspeciales(list);
      setMatEspeciales(mat ? { ...matEspeciales, [idx]: value } : matEspeciales);
      const tabItems = getRenderedItems();
      recalcFrom(tabItems, list);
      return;
    }

    let computedItems = null;
    setOpciones((prev) => {
      const next = [...prev];
      const tab = { ...next[activeOpcion] };
      const items = [...tab.items];
      const mat = materiales.find((m) => m.nombre === value);
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
      tab.items = items;
      next[activeOpcion] = tab;
      computedItems = [...tab.items];
      return next;
    });

    if (computedItems) recalcFrom(computedItems, especiales);
  };

  const addEspecial = () => {
    if (!nuevoEspecial) return;
    const tipo = TIPOS_ESPECIALES.find((t) => t.detalle === nuevoEspecial);
    if (!tipo) return;
    setEspeciales([...especiales, emptyItem(tipo.detalle, tipo.es_unidad)]);
    setNuevoEspecial('');
  };

  const removeEspecial = (idx) => {
    if (especiales.length <= 1 && especiales[0].detalle === 'ZOCALOS') return;
    const list = especiales.filter((_, i) => i !== idx);
    setEspeciales(list);
    const tabItems = getRenderedItems();
    recalcFrom(tabItems, list);
  };

  const updateItem = (idx, field, value, isEspecial) => {
    if (isEspecial) {
      const num = (v) => v === '' || v === null || v === undefined ? 0 : Number(v);
      const numericFields = ['largo', 'ancho', 'm2', 'mano_de_obra', 'cantidad', 'precio_unitario', 'subtotal'];
      const parsed = numericFields.includes(field) ? num(value) : value;
      const list = [...especiales];
      list[idx] = { ...list[idx], [field]: parsed };

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

      setEspeciales(list);
      const tabItems = getRenderedItems();
      recalcFrom(tabItems, list);
      return;
    }

    updateAndSync(activeOpcion, idx, field, value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const allLon = opciones.flatMap((tab, ti) =>
        tab.items.map((i) => ({ ...i, opcion: ti }))
      );
      const allItems = [...allLon, ...especiales.map((e) => ({ ...e, opcion: -1 }))];
      let ars = 0, usd = 0;
      allItems.forEach((i) => { if (i.moneda === 'USD') usd += Number(i.subtotal) || 0; else ars += Number(i.subtotal) || 0; });
      const cons = Math.round((ars + usd * Number(dolarDia)) * 100) / 100;
      const piletaItems = especiales.filter((e) => e.detalle === 'PILETA MOD' && e.pileta_id);
      const payload = {
        cliente, telefono, tipo_obra: tipoObra, fecha,
        dolar_dia: Number(dolarDia),
        items: allItems,
        total_neto_ars: Math.round(ars * 100) / 100,
        total_neto_usd: Math.round(usd * 100) / 100,
        total_consolidado: cons,
        pileta_id: piletaItems.length ? Number(piletaItems[0].pileta_id) : null,
        pileta_precio: piletaItems.length ? (Number(piletaItems[0].precio_unitario) || 0) : 0,
      };
      if (isEdit) await updatePresupuestoOnline(id, payload);
      else await createPresupuestoOnline(payload);
      navigate('/presupuestos-online');
    } catch (err) { alert('Error al guardar'); }
    finally { setSaving(false); }
  };

  const generarWhatsApp = () => {
    const L = [];
    L.push('AFAMAR - MARMOLES & GRANITOS');
    L.push('LA PLATA, BS AS');
    if (cliente) L.push(`Cliente: ${cliente}`);
    if (tipoObra) L.push(`Obra: ${tipoObra}`);
    if (fecha) L.push(`Fecha: ${fecha}`);
    L.push('');

    const tabItems = getRenderedItems();
    const all = [...tabItems, ...especiales];
    const itemsUsd = all.filter((i) => i.subtotal > 0 && i.moneda === 'USD');
    const itemsArs = all.filter((i) => i.subtotal > 0 && i.moneda === 'ARS');

    if (itemsUsd.length) {
      L.push('Cotizado en DOLARES (USD):');
      itemsUsd.forEach((i) => {
        let t = `. ${i.detalle}`;
        if (i.es_unidad) t += ` | Cant: ${i.cantidad}`;
        else if (i.m2 > 0) t += ` | ${i.largo}x${i.ancho} = ${i.m2.toFixed(5)} m2`;
        t += ` | USD ${i.precio_unitario.toFixed(2)}/u = USD ${i.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
        L.push(t);
      });
      L.push('');
    }
    if (itemsArs.length) {
      L.push('Cotizado en PESOS (ARS):');
      itemsArs.forEach((i) => {
        let t = `. ${i.detalle}`;
        if (i.es_unidad) t += ` | Cant: ${i.cantidad}`;
        else if (i.m2 > 0) t += ` | ${i.largo}x${i.ancho} = ${i.m2.toFixed(5)} m2`;
        t += ` | $ ${i.precio_unitario.toFixed(2)}/u = $ ${i.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
        L.push(t);
      });
      L.push('');
    }
    L.push('==============================');
    if (totalUsd > 0) L.push(`TOTAL USD: USD ${totalUsd.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`);
    if (totalArs > 0) L.push(`TOTAL ARS: $ ${totalArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`);
    if (totalUsd > 0 && dolarDia > 0) {
      L.push(`Dolar del dia: $${Number(dolarDia).toLocaleString('es-AR')}`);
      L.push(`TOTAL CONSOLIDADO: $ ${totalConsolidado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`);
    }
    L.push('');
    L.push('Consultas al WhatsApp');
    return L.join('\n');
  };

  const inputStyle = { width: '100%', padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, textAlign: 'right', boxSizing: 'border-box' };
  const inputTextStyle = { ...inputStyle, textAlign: 'left' };
  const selectStyle = { ...inputStyle, textAlign: 'center', cursor: 'pointer' };
  const cellStyle = { padding: '3px 4px' };

  const hayUSD = [...getRenderedItems(), ...especiales].some((i) => i.moneda === 'USD');

  if (loading) return <Loading />;

  const renderedItems = getRenderedItems();

  const computeTabTotal = (tabIdx) => {
    const tab = opciones[tabIdx];
    if (!tab) return { ars: 0, usd: 0 };
    let ars = 0, usd = 0;
    tab.items.forEach((i) => {
      if (i.moneda === 'USD') usd += i.subtotal || 0;
      else ars += i.subtotal || 0;
    });
    return { ars: Math.round(ars * 100) / 100, usd: Math.round(usd * 100) / 100 };
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>
          {isEdit ? `Presupuesto ${numero}` : `Nuevo Presupuesto ${numero || ''}`}
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#b91c1c', marginBottom: 12 }}>
            AFAMAR - MARMOLES & GRANITOS - LA PLATA, BS AS
            {numero && <span style={{ marginLeft: 16, fontSize: 18, color: '#c0392b' }}>PRESUPUESTO N {numero}</span>}
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
              <label>CLIENTE / EMPRESA</label>
              <input className="input" value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nombre del cliente" />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
              <label>TELÉFONO (WhatsApp)</label>
              <input className="input" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Ej: 2215551234" />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
              <label>TIPO DE OBRA</label>
              <input className="input" value={tipoObra} onChange={(e) => setTipoObra(e.target.value)} placeholder="Ej: Cocina, Bano" />
            </div>
            <div className="form-group" style={{ width: 140 }}>
              <label>FECHA</label>
              <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="form-group" style={{ width: 160 }}>
              <label style={{ fontWeight: 700, color: '#1e40af' }}>DOLAR DEL DIA</label>
              <input type="number" step="1" className="input" style={{ fontWeight: 700, color: '#1e40af', borderColor: '#93c5fd', textAlign: 'center', fontSize: 16 }}
                value={dolarDia} onChange={(e) => { const v = e.target.value; const nd = v === '' ? 0 : parseFloat(v) || 0; setDolarDia(nd); const tabItems = getRenderedItems(); recalcFrom(tabItems, especiales, nd); }} />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16, overflowX: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {opciones.map((tab, ti) => (
              <div key={ti} style={{ display: 'flex', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    const tabItems = opciones[ti]?.items || [];
                    recalcFrom(tabItems, especiales);
                    setActiveOpcion(ti);
                  }}
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
                  }}
                >
                  {tab.nombre}
                  {opciones.length > 1 && (
                    <span
                      onClick={(e) => { e.stopPropagation(); removeOpcion(ti); }}
                      style={{ marginLeft: 4, color: ti === activeOpcion ? '#fca5a5' : '#94a3b8', fontSize: 14, lineHeight: 1, cursor: 'pointer' }}
                      title="Eliminar opción"
                    >×</span>
                  )}
                </button>
                {ti !== activeOpcion && (
                  <div style={{ fontSize: 10, color: '#64748b', marginLeft: 4, whiteSpace: 'nowrap' }}>
                    {(() => { const t = computeTabTotal(ti); const parts = []; if (t.ars > 0) parts.push(`$${t.ars.toLocaleString('es-AR')}`); if (t.usd > 0) parts.push(`USD ${t.usd.toLocaleString('es-AR')}`); return parts.join(' + '); })()}
                  </div>
                )}
              </div>
            ))}
            <button type="button" onClick={addOpcion} style={{
              background: 'none', border: '1px dashed #94a3b8', borderRadius: '6px 6px 0 0',
              padding: '6px 12px', fontSize: 12, color: '#64748b', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Plus size={14} /> Agregar opción de material
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ ...cellStyle, textAlign: 'left', width: '16%' }}>Sector / Modelo</th>
                <th style={{ ...cellStyle, textAlign: 'center', width: '8%' }}>Largo</th>
                <th style={{ ...cellStyle, textAlign: 'center', width: '8%' }}>Ancho</th>
                <th style={{ ...cellStyle, textAlign: 'center', width: '8%' }}>M2/U</th>
                <th style={{ ...cellStyle, textAlign: 'center', width: '7%' }}>Cant.</th>
                <th style={{ ...cellStyle, textAlign: 'center', width: '7%' }}>Moneda</th>
                <th style={{ ...cellStyle, textAlign: 'right', width: '12%' }}>Precio Unit.</th>
                <th style={{ ...cellStyle, textAlign: 'right', width: '12%' }}>Subtotal</th>
                <th style={{ width: 26 }}></th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ background: '#e0f2fe' }}>
                <td colSpan={9} style={{ ...cellStyle, fontWeight: 700, fontSize: 12, color: '#0369a1' }}>
                  PRODUCCION ESTANDAR {opciones.length > 1 && <span style={{ fontWeight: 400 }}>— {opciones[activeOpcion]?.nombre}</span>}
                </td>
              </tr>
              {renderedItems.map((item, idx) => (
                <tr key={'i' + idx}>
                  <td style={cellStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}>LONGITUD :</span>
                      <select style={{ ...inputTextStyle, flex: 1 }} value={item.detalle} onChange={(e) => handleDetalleChange(idx, e.target.value, false)}>
                        <option value="">-- sin material --</option>
                        {materiales.map((m) => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
                      </select>
                    </div>
                  </td>
                  <td style={cellStyle}><input type="number" step="any" style={inputStyle} value={item.largo || ''} onChange={(e) => updateItem(idx, 'largo', e.target.value, false)} /></td>
                  <td style={cellStyle}><input type="number" step="any" style={inputStyle} value={item.ancho || ''} onChange={(e) => updateItem(idx, 'ancho', e.target.value, false)} /></td>
                  <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 600 }}>{item.m2 > 0 ? item.m2.toFixed(5) : '-'}</td>
                  <td style={cellStyle}><input type="number" style={inputStyle} value={item.cantidad} onChange={(e) => updateItem(idx, 'cantidad', e.target.value, false)} min="1" /></td>
                  <td style={cellStyle}>
                    <select style={selectStyle} value={item.moneda} onChange={(e) => updateItem(idx, 'moneda', e.target.value, false)} disabled={item.detalle !== 'LONGITUD' && item.detalle !== ''}>
                      <option value="ARS">ARS</option><option value="USD">USD</option>
                    </select>
                  </td>
                  <td style={cellStyle}><input type="number" step="any" style={inputStyle} value={item.precio_unitario || ''} onChange={(e) => updateItem(idx, 'precio_unitario', e.target.value, false)} /></td>
                  <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 600, color: item.moneda === 'USD' ? '#059669' : '#1e293b' }}>
                    {item.moneda === 'USD' ? 'USD ' : '$ '}{(item.subtotal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={cellStyle}>
                    <button type="button" onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }} title="Eliminar">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={9} style={{ padding: '4px 0', textAlign: 'center' }}>
                  <button type="button" onClick={addItem} className="btn btn-outline" style={{ fontSize: 11, padding: '4px 12px' }}>
                    <Plus size={12} /> Agregar otra longitud
                  </button>
                </td>
              </tr>

              {opciones.length > 1 && (
                <tr style={{ background: '#f0fdf4' }}>
                  <td colSpan={9} style={{ padding: '6px 8px', fontSize: 11 }}>
                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                      {opciones.map((tab, ti) => {
                        const t = computeTabTotal(ti);
                        return (
                          <div key={ti} style={{
                            padding: '4px 12px',
                            background: ti === activeOpcion ? '#dcfce7' : 'transparent',
                            borderRadius: 4,
                          }}>
                            <span style={{ fontWeight: 700, color: '#166534' }}>{tab.nombre}: </span>
                            {t.ars > 0 && <span style={{ color: '#1e293b', fontWeight: 600 }}>$ {t.ars.toLocaleString('es-AR', { minimumFractionDigits: 2 })} </span>}
                            {t.usd > 0 && <span style={{ color: '#059669', fontWeight: 600 }}>USD {t.usd.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>}
                            {t.ars === 0 && t.usd === 0 && <span style={{ color: '#94a3b8' }}>$ 0,00</span>}
                          </div>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              )}

              <tr style={{ background: '#fef3c7' }}>
                <td colSpan={9} style={{ ...cellStyle, fontWeight: 700, fontSize: 12, color: '#92400e' }}>
                  CORTES Y ACCESORIOS
                </td>
              </tr>
              {especiales.map((item, idx) => (
                <tr key={'e' + idx}>
                  <td style={cellStyle}>
                    {item.detalle === 'PILETA MOD' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}>PILETA MOD :</span>
                        <select className="input" style={{ fontSize: 11, flex: 1 }} value={item.pileta_id || ''} onChange={(e) => {
                          const pid = e.target.value;
                          const p = piletas.find((x) => x.id === Number(pid));
                          const precio = p ? (p.precio || 0) : 0;
                          const list = [...especiales];
                          list[idx] = { ...list[idx], pileta_id: Number(pid), moneda: 'ARS', precio_unitario: precio, subtotal: Math.round((Number(list[idx].cantidad) || 1) * precio * 100) / 100 };
                          setEspeciales(list);
                          const tabItems = getRenderedItems();
                          recalcFrom(tabItems, list);
                        }}>
                          <option value="">Seleccionar...</option>
                          {piletas.map((p) => (<option key={p.id} value={p.id}>{p.marca} - {p.modelo} (Stock: {p.cantidad})</option>))}
                        </select>
                      </div>
                    ) : item.detalle === 'TERMINACION' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ fontWeight: 700, fontSize: 11 }}>TERMINACION</span>
                        <input style={{ ...inputTextStyle, fontSize: 11 }} placeholder="Tipo de terminacion..." />
                      </div>
                    ) : item.es_unidad ? (
                      <span style={{ fontWeight: 700, fontSize: 12 }}>{item.detalle}</span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}>{item.detalle} :</span>
                        <select style={{ ...inputTextStyle, flex: 1 }} value={matEspeciales[idx] || ''} onChange={(e) => handleDetalleChange(idx, e.target.value, true)}>
                          <option value="">-- sin material --</option>
                          {materiales.map((m) => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
                        </select>
                      </div>
                    )}
                  </td>
                  <td style={cellStyle}>
                    {item.detalle === 'TERMINACION' ? (
                      <input type="number" step="any" style={inputStyle} value={item.largo || ''} onChange={(e) => updateItem(idx, 'largo', e.target.value, true)} placeholder="Mts lineales" />
                    ) : !item.es_unidad && (<input type="number" step="any" style={inputStyle} value={item.largo || ''} onChange={(e) => updateItem(idx, 'largo', e.target.value, true)} />)}
                  </td>
                  <td style={cellStyle}>
                    {item.detalle === 'TERMINACION' ? (
                      <input type="number" step="any" style={inputStyle} value={item.mano_de_obra || ''} onChange={(e) => updateItem(idx, 'mano_de_obra', e.target.value, true)} placeholder="Mano de obra" />
                    ) : !item.es_unidad ? (<input type="number" step="any" style={inputStyle} value={item.ancho || ''} onChange={(e) => updateItem(idx, 'ancho', e.target.value, true)} placeholder="Altura" />) : null}
                  </td>
                  <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 600, color: item.es_unidad ? '#b91c1c' : '#1e293b' }}>
                    {item.detalle === 'TERMINACION' ? '$' + (item.precio_unitario || 0).toLocaleString('es-AR') : item.es_unidad ? 'U' : (item.m2 > 0 ? item.m2.toFixed(5) : '-')}
                  </td>
                  <td style={cellStyle}><input type="number" style={inputStyle} value={item.cantidad} onChange={(e) => updateItem(idx, 'cantidad', e.target.value, true)} min="1" /></td>
                  <td style={cellStyle}>
                    <select style={selectStyle} value={item.moneda} onChange={(e) => {
                      const nuevoMoneda = e.target.value;
                      const list = [...especiales];
                      list[idx] = { ...list[idx], moneda: nuevoMoneda };
                      if (item.detalle === 'PILETA MOD' && item.pileta_id) {
                        const p = piletas.find((x) => x.id === Number(item.pileta_id));
                        if (p) {
                          const nuevoPrecio = nuevoMoneda === 'USD' ? (p.precio_usd || 0) : (p.precio || 0);
                          list[idx].precio_unitario = nuevoPrecio;
                          list[idx].subtotal = Math.round((Number(list[idx].cantidad) || 1) * nuevoPrecio * 100) / 100;
                        }
                      }
                      setEspeciales(list);
                      const tabItems = getRenderedItems();
                      recalcFrom(tabItems, list);
                    }} disabled={!!matEspeciales[idx]}>
                      <option value="ARS">ARS</option><option value="USD">USD</option>
                    </select>
                  </td>
                  <td style={cellStyle}><input type="number" step="any" style={inputStyle} value={item.precio_unitario || ''} onChange={(e) => updateItem(idx, 'precio_unitario', e.target.value, true)} /></td>
                  <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 600, color: item.moneda === 'USD' ? '#059669' : '#1e293b' }}>
                    {item.moneda === 'USD' ? 'USD ' : '$ '}{(item.subtotal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={cellStyle}>
                    <button type="button" onClick={() => removeEspecial(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }} title="Eliminar">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={9} style={{ padding: '4px 0' }}>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
                    <select className="input" style={{ width: 200, fontSize: 11 }} value={nuevoEspecial} onChange={(e) => setNuevoEspecial(e.target.value)}>
                      <option value="">-- Agregar corte o accesorio --</option>
                      {TIPOS_ESPECIALES.map((t) => <option key={t.detalle} value={t.detalle}>{t.detalle}</option>)}
                    </select>
                    <button type="button" onClick={addEspecial} className="btn btn-outline" style={{ fontSize: 11, padding: '4px 12px' }}>
                      <Plus size={12} /> Agregar
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, color: '#64748b' }}>TOTAL NETO ARS</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>$ {totalArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
            </div>
            {hayUSD && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, color: '#64748b' }}>TOTAL NETO USD</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#059669' }}>USD {totalUsd.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
            </div>
            )}
            <div style={{ textAlign: 'right', background: '#dc2626', color: 'white', padding: '10px 24px', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>TOTAL CONSOLIDADO</div>
              {hayUSD && (<div style={{ fontSize: 14, fontWeight: 400, opacity: 0.8 }}>{`(ARS + USD x $${Number(dolarDia).toLocaleString('es-AR')})`}</div>)}
              <div style={{ fontSize: 22, fontWeight: 800 }}>$ {totalConsolidado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-success" onClick={() => { navigator.clipboard.writeText(generarWhatsApp()); alert('Copiado! Pegalo en WhatsApp.'); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            Exportar para WhatsApp
          </button>
          <button type="button" className="btn btn-outline" onClick={() => navigate('/presupuestos-online')}>Cancelar</button>
          {isEdit && (
            <button type="button" className="btn" onClick={async () => {
              if (!window.confirm('¿Convertir a Orden de Trabajo? Se copiarán todos los ítems.')) return;
              try {
                const res = await convertirOnlineAOrden(id);
                alert(`Orden ${res.data.numero} creada.`);
                navigate('/ordenes');
              } catch (err) { alert(err.response?.data?.detail || 'Error'); }
            }} style={{ background: '#b91c1c', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileOutput size={16} /> CONVERTIR A OT
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ background: '#b91c1c' }}>
            <Save size={16} /> {saving ? 'GUARDANDO...' : 'GUARDAR'}
          </button>
        </div>
      </form>
    </div>
  );
}
