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
  const [items, setItems] = useState(FILAS_INICIALES.map((f) => emptyItem(f.detalle, f.es_unidad)));
  const [especiales, setEspeciales] = useState(ESPECIALES_INICIALES.map((e) => emptyItem(e.detalle, e.es_unidad)));
  const [nuevoEspecial, setNuevoEspecial] = useState('');
  const [matEspeciales, setMatEspeciales] = useState({});
  const [cliente, setCliente] = useState('');
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

  useEffect(() => {
    if (isEdit) {
      getPresupuestoOnline(id).then((res) => {
        const d = res.data;
        setCliente(d.cliente || '');
        setTipoObra(d.tipo_obra || '');
        setFecha(d.fecha || new Date().toISOString().slice(0, 10));
        setDolarDia(d.dolar_dia ?? 1000);
        setNumero(d.numero || '');
        setTotalArs(d.total_neto_ars || 0);
        setTotalUsd(d.total_neto_usd || 0);
        setTotalConsolidado(d.total_consolidado || 0);
        const toNum = (v) => v === '' || v === null || v === undefined ? 0 : Number(v);
        if (d.items?.length) {
          const normales = d.items.filter((i) => !i.es_unidad && !NOMBRES_ESPECIALES.has(i.detalle)).map((i) => ({ ...i, largo: toNum(i.largo), ancho: toNum(i.ancho), m2: toNum(i.m2), cantidad: Math.max(1, toNum(i.cantidad)), precio_unitario: toNum(i.precio_unitario), subtotal: toNum(i.subtotal), mano_de_obra: toNum(i.mano_de_obra) }));
          const esp = d.items.filter((i) => i.es_unidad || NOMBRES_ESPECIALES.has(i.detalle)).map((i) => {
            const e = { ...i, largo: toNum(i.largo), ancho: toNum(i.ancho), m2: toNum(i.m2), cantidad: Math.max(1, toNum(i.cantidad)), precio_unitario: toNum(i.precio_unitario), subtotal: toNum(i.subtotal), mano_de_obra: toNum(i.mano_de_obra) };
            if (e.detalle === 'PILETA MOD' && !e.pileta_id && d.pileta_id) e.pileta_id = Number(d.pileta_id);
            return e;
          });
          setItems(normales.length ? normales : FILAS_INICIALES.map((f) => emptyItem(f.detalle, f.es_unidad)));
          setEspeciales(esp.length ? esp : ESPECIALES_INICIALES.map((e) => emptyItem(e.detalle, e.es_unidad)));
          const matEsp = {};
          esp.forEach((e, i) => { if (e.material) matEsp[i] = e.material; });
          setMatEspeciales(matEsp);
          recalcFrom([...normales, ...esp], d.dolar_dia ?? 1000);
        }
        setLoading(false);
      }).catch((err) => {
        console.error('Error al cargar presupuesto online', err);
        alert('Error al cargar el presupuesto');
        setLoading(false);
      });
    }
  }, [id, isEdit]);

  const addItem = () => {
    setItems([...items, emptyItem('LONGITUD', false)]);
  };

  const removeItem = (idx) => {
    if (items.length <= 1) return;
    const list = items.filter((_, i) => i !== idx);
    setItems(list);
    recalcFrom([...list, ...especiales]);
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
    recalcFrom([...items, ...list]);
  };

  const updateItem = (idx, field, value, isEspecial) => {
    const list = isEspecial ? [...especiales] : [...items];
    const num = (v) => v === '' || v === null || v === undefined ? 0 : Number(v);
    const numericFields = ['largo', 'ancho', 'm2', 'mano_de_obra', 'cantidad', 'precio_unitario', 'subtotal'];
    const parsed = numericFields.includes(field) ? num(value) : value;
    list[idx] = { ...list[idx], [field]: parsed };

    if (field === 'largo' || field === 'ancho' || field === 'mano_de_obra') {
      const la = Number(list[idx].largo) || 0;
      const an = Number(list[idx].ancho) || 0;
      if (list[idx].detalle === 'TERMINACION') {
        const mo = Number(list[idx].mano_de_obra) || 0;
        list[idx].subtotal = Math.round(la * mo * 100) / 100;
        list[idx].precio_unitario = Math.round(la * mo * 100) / 100;
      } else if (!list[idx].es_unidad) {
        list[idx].m2 = Math.round(la * an * 10000) / 10000;
      }
    }

    const m2 = list[idx].m2 || 0;
    const cant = Number(list[idx].cantidad) || 1;
    const pu = Number(list[idx].precio_unitario) || 0;
    if (list[idx].detalle === 'TERMINACION') {
      // ya calculado arriba
    } else if (list[idx].es_unidad) {
      list[idx].subtotal = Math.round(cant * pu * 100) / 100;
    } else if (m2 > 0) {
      list[idx].subtotal = Math.round(m2 * cant * pu * 100) / 100;
    } else {
      list[idx].subtotal = Math.round(cant * pu * 100) / 100;
    }

    if (isEspecial) { setEspeciales(list); recalcFrom([...items, ...list]); }
    else { setItems(list); recalcFrom([...list, ...especiales]); }
  };

  const handleDetalleChange = (idx, value, isEspecial) => {
    const mat = materiales.find((m) => m.nombre === value);
    const list = isEspecial ? [...especiales] : [...items];
    if (mat) {
      if (!isEspecial) list[idx].detalle = value;
      if (isEspecial) list[idx].material = value;
      list[idx].moneda = mat.moneda || 'ARS';
      list[idx].precio_unitario = mat.moneda === 'USD' ? (mat.precio_m2_usd || 0) : (mat.precio_m2 || 0);
      const m2 = list[idx].m2 || 0;
      const cant = Number(list[idx].cantidad) || 1;
      const pu = Number(list[idx].precio_unitario) || 0;
      if (!list[idx].es_unidad && m2 > 0) {
        list[idx].subtotal = Math.round(m2 * cant * pu * 100) / 100;
      }
    } else if (!isEspecial) {
      list[idx].detalle = 'LONGITUD';
      list[idx].moneda = 'ARS';
      list[idx].precio_unitario = 0;
    }
    if (isEspecial) { setEspeciales(list); setMatEspeciales(mat ? { ...matEspeciales, [idx]: value } : matEspeciales); recalcFrom([...items, ...list]); }
    else { setItems(list); recalcFrom([...list, ...especiales]); }
  };

  const recalcFrom = (all, ddOverride) => {
    let ars = 0, usd = 0;
    all.forEach((i) => {
      if (i.moneda === 'USD') usd += i.subtotal || 0;
      else ars += i.subtotal || 0;
    });
    setTotalArs(Math.round(ars * 100) / 100);
    setTotalUsd(Math.round(usd * 100) / 100);
    const dd = ddOverride !== undefined ? ddOverride : Number(dolarDia);
    setTotalConsolidado(Math.round((ars + usd * dd) * 100) / 100);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const allItems = [...items, ...especiales];
      let ars = 0, usd = 0;
      allItems.forEach((i) => { if (i.moneda === 'USD') usd += Number(i.subtotal) || 0; else ars += Number(i.subtotal) || 0; });
      const cons = Math.round((ars + usd * Number(dolarDia)) * 100) / 100;
      const piletaItems = especiales.filter((e) => e.detalle === 'PILETA MOD' && e.pileta_id);
      const payload = {
        cliente, tipo_obra: tipoObra, fecha,
        dolar_dia: Number(dolarDia),
        items: allItems,
        total_neto_ars: Math.round(ars * 100) / 100,
        total_neto_usd: Math.round(usd * 100) / 100,
        total_consolidado: cons,
        pileta_id: piletaItems.length ? Number(piletaItems[0].pileta_id) : null,
        pileta_precio: piletaItems.length ? (Number(piletaItems[0].precio_unitario) || 0) : 0,
      };
      console.log('[PresupuestoOnlineForm] payload:', JSON.stringify(payload, null, 2));
      console.log('[PresupuestoOnlineForm] items con pileta_id:', allItems.filter(i => i.pileta_id));
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

    const all = [...items, ...especiales];
    const itemsUsd = all.filter((i) => i.subtotal > 0 && i.moneda === 'USD');
    const itemsArs = all.filter((i) => i.subtotal > 0 && i.moneda === 'ARS');

    if (itemsUsd.length) {
      L.push('Cotizado en DOLARES (USD):');
      itemsUsd.forEach((i) => {
        let t = `. ${i.detalle}`;
        if (i.es_unidad) t += ` | Cant: ${i.cantidad}`;
        else if (i.m2 > 0) t += ` | ${i.largo}x${i.ancho} = ${i.m2.toFixed(4)} m2`;
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
        else if (i.m2 > 0) t += ` | ${i.largo}x${i.ancho} = ${i.m2.toFixed(4)} m2`;
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

  const hayUSD = [...items, ...especiales].some((i) => i.moneda === 'USD');

  if (loading) return <Loading />;

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
                value={dolarDia} onChange={(e) => { const v = e.target.value; const nd = v === '' ? 0 : parseFloat(v) || 0; setDolarDia(nd); recalcFrom([...items, ...especiales], nd); }} />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16, overflowX: 'auto' }}>
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
                  PRODUCCION ESTANDAR
                </td>
              </tr>
              {items.map((item, idx) => (
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
                  <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 600 }}>{item.m2 > 0 ? item.m2.toFixed(4) : '-'}</td>
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
                          recalcFrom([...items, ...list]);
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
                    {item.detalle === 'TERMINACION' ? '$' + (item.precio_unitario || 0).toLocaleString('es-AR') : item.es_unidad ? 'U' : (item.m2 > 0 ? item.m2.toFixed(4) : '-')}
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
                      recalcFrom([...items, ...list]);
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
              {hayUSD && (<div style={{ fontSize: 14, fontWeight: 400, opacity: 0.8 }}>(ARS + USD x ${Number(dolarDia).toLocaleString('es-AR')})</div>)}
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
                console.log('[PresupuestoOnlineForm] converting id:', id);
                const res = await convertirOnlineAOrden(id);
                console.log('[PresupuestoOnlineForm] convert result:', res.data);
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
