import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Eye, Save, Printer, MoreVertical, Copy, FileDown, Trash2, History, Plus, X, Upload } from 'lucide-react';
import api, { getOrden, createOrden, updateOrden, deleteOrden, getMateriales, getPiletas, getClientes, getNextNumero, getConfig } from '../../services/api';
import { formatCurrency, badgeClass, espesores, acabados, conceptosFabricacion } from '../../utils/formatters';
import CroquisEditor from './CroquisEditor';
import FirmaCanvas from './FirmaCanvas';
import Loading from '../common/Loading';
import ConfirmDialog from '../common/ConfirmDialog';

export default function OrdenForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [materiales, setMateriales] = useState([]);
  const [piletas, setPiletas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const menuRef = useRef(null);
  const clienteRef = useRef(null);
  const materialPrecioRef = useRef(0);
  const materialUsdRef = useRef(0);

  const [form, setForm] = useState({
    numero: '',
    cliente_nombre: '', cliente_telefono_orden: '', domicilio: '', email: '',
    fecha: new Date().toISOString().slice(0, 10),
    estado: 'EN MEDICIÓN',
    material: '', material_precio_m2: 0, color_tipo: '', espesor: '', acabado: '', tipo_cambio: 1,
    bacha: '', anafe: '',
    croquis: [],
    observaciones_diseno: '',
    detalles_fabricacion: [],
    pileta_id: '', pileta_imagen: '', pileta_precio: 0, pileta_moneda: 'ARS',
    subtotal: 0, traslado: 0, total: 0,
    sena_recibida: 0, saldo_pendiente: 0, forma_pago: '', saldo_pagado: false, fecha_pago_saldo: '',
    dolar_dia: 1000,
    subtotal_usd: 0, traslado_usd: 0, total_usd: 0, sena_usd: 0, saldo_pendiente_usd: 0,
    fecha_entrega: '',
    firma_cliente: null, fecha_aprobacion: '',
    observaciones: '', observaciones_importantes: '',
    detalles_presupuestados: [],
  });

  useEffect(() => {
    getMateriales({ limit: 500 }).then((res) => {
      setMateriales(res.data);
    });
    getPiletas().then((res) => setPiletas(res.data));
    getClientes({ limit: 500 }).then((res) => setClientes(res.data));
    getConfig().then((res) => {
      const logo = res.data.find((c) => c.key === 'logo');
      if (logo?.value) {
        const base = (api.defaults.baseURL || 'http://localhost:8000/api').replace('/api', '');
        setLogoUrl(`${base}/${logo.value}`);
      }
    });
    if (id) {
      getOrden(id).then((res) => {
        const d = res.data;
        setForm({
          numero: d.numero || '',
          cliente_nombre: d.cliente_nombre || '',
          cliente_telefono_orden: d.cliente_telefono_orden || '',
          domicilio: d.domicilio || '',
          email: d.email || '',
          fecha: d.fecha ? d.fecha.slice(0, 10) : new Date().toISOString().slice(0, 10),
          estado: d.estado || 'EN MEDICIÓN',
          material: d.material || '',
          material_precio_m2: d.material_precio_m2 || 0,
          tipo_cambio: d.tipo_cambio || 1,
          color_tipo: d.color_tipo || '',
          espesor: d.espesor || '',
          acabado: d.acabado || '',
          bacha: d.bacha || '',
          anafe: d.anafe || '',
          croquis: d.croquis || [],
          observaciones_diseno: d.observaciones_diseno || '',
          detalles_fabricacion: d.detalles_fabricacion?.length ? d.detalles_fabricacion.map((df) => ({ ...df, largo: df.largo || 0, ancho: df.ancho || 0, m2: df.m2 || 0, mano_de_obra: df.mano_de_obra || 0, precio: df.precio || 0 })) : [],
          detalles_presupuestados: d.detalles_presupuestados || [],
          pileta_id: d.pileta_id || '',
          pileta_precio: d.pileta_precio || 0,
          pileta_moneda: d.pileta_moneda || 'ARS',
          pileta_imagen: d.pileta_imagen || '',
          subtotal: d.subtotal || 0,
          traslado: d.traslado || 0,
          total: d.total || 0,
          sena_recibida: d.sena_recibida || 0,
          saldo_pendiente: d.saldo_pendiente || 0,
          forma_pago: d.forma_pago || '',
          saldo_pagado: d.saldo_pagado || false,
          fecha_pago_saldo: d.fecha_pago_saldo ? d.fecha_pago_saldo.slice(0, 10) : '',
          dolar_dia: d.dolar_dia ?? 1000,
          subtotal_usd: d.subtotal_usd || 0,
          traslado_usd: d.traslado_usd || 0,
          total_usd: d.total_usd || 0,
          sena_usd: d.sena_usd || 0,
          saldo_pendiente_usd: d.saldo_pendiente_usd || 0,
          fecha_entrega: d.fecha_entrega ? d.fecha_entrega.slice(0, 10) : '',
          firma_cliente: d.firma_cliente || null,
          fecha_aprobacion: d.fecha_aprobacion ? d.fecha_aprobacion.slice(0, 10) : '',
          observaciones: d.observaciones || '',
          observaciones_importantes: d.observaciones_importantes || '',
        });
        setLoading(false);
      });
    }
  }, [id]);

  useEffect(() => {
    if (!isEdit) {
      getNextNumero().then((res) => {
        setForm((prev) => ({ ...prev, numero: res.data.numero }));
      }).catch(() => {
        // backend sin reiniciar, ignorar
      });
    }
  }, [isEdit]);

  useEffect(() => {
    if (isEdit && materiales.length > 0 && form.material) {
      const foundMat = materiales.find((mat) => mat.nombre === form.material);
      if (foundMat) {
        materialUsdRef.current = foundMat.precio_m2_usd || 0;
      }
    }
  }, [materiales, isEdit, form.material]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    materialPrecioRef.current = form.material_precio_m2;
    const arsTotal = (form.detalles_fabricacion || []).reduce((sum, d) => sum + ((d.moneda === 'USD') ? 0 : Number(d.precio) || 0), 0);
    const usdTotal = (form.detalles_fabricacion || []).reduce((sum, d) => sum + ((d.moneda === 'USD') ? Number(d.precio) || 0 : 0), 0);
    const dd = Number(form.dolar_dia);
    const pp = Number(form.pileta_precio) || 0;
    const ppArs = form.pileta_moneda === 'USD' ? (dd > 0 ? Math.round(pp * dd * 100) / 100 : 0) : pp;
    const subtotal = arsTotal + (dd > 0 ? Math.round(usdTotal * dd * 100) / 100 : 0) + ppArs;
    const tr = Number(form.traslado) || 0;
    const total = Math.max(0, subtotal + tr);
    const saldo = Math.max(0, total - (Number(form.sena_recibida) || 0));
    const tr_usd = Number(form.traslado_usd) || 0;
    const sena_usd = Number(form.sena_usd) || 0;
    const subtotal_usd = dd > 0 ? Math.round((subtotal / dd) * 100) / 100 : 0;
    const total_usd = Math.max(0, subtotal_usd + tr_usd);
    const saldo_pendiente_usd = Math.max(0, total_usd - sena_usd);

    setForm((prev) => ({
      ...prev,
      subtotal,
      total,
      saldo_pendiente: saldo,
      subtotal_usd,
      total_usd,
      saldo_pendiente_usd,
    }));
  }, [form.detalles_fabricacion, form.traslado, form.pileta_precio, form.pileta_moneda, form.sena_recibida, form.traslado_usd, form.sena_usd, form.dolar_dia]);

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
      if (clienteRef.current && !clienteRef.current.contains(e.target)) setShowClienteDropdown(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleMaterialChange = (nombre) => {
    const m = materiales.find((mat) => mat.nombre === nombre);
    if (m) {
      const currency = m.moneda || 'ARS';
      const usdPrice = m.precio_m2_usd || 0;
      const arsPrice = m.precio_m2 || 0;
      materialUsdRef.current = usdPrice;
      setForm((prev) => {
        const tc = prev.dolar_dia ?? 1000;
        const pm2 = currency === 'USD'
          ? Math.round(usdPrice * tc * 100) / 100
          : arsPrice;
        materialPrecioRef.current = pm2;
        return {
          ...prev,
          material: nombre,
          color_tipo: m.color || '',
          espesor: m.espesor_disponible || '',
          material_precio_m2: pm2,
          detalles_fabricacion: (prev.detalles_fabricacion || []).map((d) => {
            if (CONCEPTOS_M2.includes(d.concepto) && d.m2 > 0) {
              return { ...d, precio: Math.round(d.m2 * pm2 * 100) / 100 };
            }
            return d;
          }),
        };
      });
    } else {
      materialUsdRef.current = 0;
      setForm((prev) => ({ ...prev, material: nombre, material_precio_m2: 0 }));
    }
  };

  const handleClienteSelect = (c) => {
    update('cliente_nombre', c.nombre);
    update('cliente_telefono_orden', c.telefono || '');
    update('email', c.email || '');
    update('domicilio', c.direccion || '');
    setShowClienteDropdown(false);
  };

  const clientesFiltrados = clientes.filter((c) =>
    c.nombre?.toLowerCase().includes((form.cliente_nombre || '').toLowerCase())
  );

  const handlePiletaImagen = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => update('pileta_imagen', ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleTrasladoChange = (value, source) => {
    const dd = Number(form.dolar_dia);
    if (source === 'usd') {
      const usd = Number(value) || 0;
      const ars = Math.round(usd * dd * 100) / 100;
      setForm((prev) => ({ ...prev, traslado_usd: usd, traslado: ars }));
    } else {
      const ars = Number(value) || 0;
      const usd = dd > 0 ? Math.round((ars / dd) * 100) / 100 : 0;
      setForm((prev) => ({ ...prev, traslado: ars, traslado_usd: usd }));
    }
  };

  const handleSenaChange = (value, source) => {
    const dd = Number(form.dolar_dia);
    if (source === 'usd') {
      const usd = Number(value) || 0;
      const ars = Math.round(usd * dd * 100) / 100;
      setForm((prev) => ({ ...prev, sena_usd: usd, sena_recibida: ars }));
    } else {
      const ars = Number(value) || 0;
      const usd = dd > 0 ? Math.round((ars / dd) * 100) / 100 : 0;
      setForm((prev) => ({ ...prev, sena_recibida: ars, sena_usd: usd }));
    }
  };

  const handleDolarDiaChange = (value) => {
    const dd = Number(value);
    const tr_usd = Number(form.traslado_usd) || 0;
    const sena_usd = Number(form.sena_usd) || 0;
    setForm((prev) => ({
      ...prev,
      dolar_dia: dd,
      traslado: Math.round(tr_usd * dd * 100) / 100,
      sena_recibida: Math.round(sena_usd * dd * 100) / 100,
    }));
  };

  const CONCEPTOS_M2 = ['LONGITUD', 'ZÓCALO', 'FRENTE'];

  const TRAFORO_DETALLES = {
    'TRAFORO DE PILETA': 'APERTURA Y PEGADO DE PILETA',
    'TRAFORO DE ANAFE': 'APERTURA DE ANAFE',
    'TRAFORO DE APOYO': 'APERTURA PILETA DE APOYO',
  };

  const handleDetalleChange = (idx, field, value) => {
    setForm((prev) => {
      const list = [...prev.detalles_fabricacion];
      list[idx] = { ...list[idx], [field]: value };
      if (field === 'concepto' && value !== 'OTRA') {
        list[idx].concepto_personalizado = '';
      }
      if (field === 'concepto' && TRAFORO_DETALLES[value]) {
        list[idx].detalle = TRAFORO_DETALLES[value];
      }
      const d = list[idx];
      if (d.concepto === 'OTRA' && (field === 'largo' || field === 'mano_de_obra')) {
        const largo = Number(d.largo) || 0;
        const mo = Number(d.mano_de_obra) || 0;
        list[idx].precio = Math.round(largo * mo * 100) / 100;
      } else if (CONCEPTOS_M2.includes(d.concepto) && (field === 'concepto' || field === 'largo' || field === 'ancho' || field === 'moneda')) {
        const largo = Number(d.largo) || 0;
        const ancho = Number(d.ancho) || 0;
        const m2 = Math.round((largo * ancho) * 10000) / 10000;
        list[idx].m2 = m2;
        const moneda = d.moneda || 'ARS';
        const pm2 = moneda === 'USD'
          ? (materialUsdRef.current || 0)
          : (Number(materialPrecioRef.current) || Number(prev.material_precio_m2) || 0);
        list[idx].precio = Math.round(m2 * pm2 * 100) / 100;
      }
      return { ...prev, detalles_fabricacion: list };
    });
  };

  const addDetalle = () => {
    update('detalles_fabricacion', [...form.detalles_fabricacion, { concepto: 'LONGITUD', detalle: '', largo: 0, ancho: 0, m2: 0, mano_de_obra: 0, moneda: 'ARS', precio: 0 }]);
  };

  const removeDetalle = (idx) => {
    if (form.detalles_fabricacion.length <= 1) return;
    update('detalles_fabricacion', form.detalles_fabricacion.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        cliente_nombre: form.cliente_nombre,
        cliente_telefono_orden: form.cliente_telefono_orden,
        domicilio: form.domicilio,
        email: form.email,
        fecha: form.fecha ? new Date(form.fecha).toISOString() : null,
        estado: form.estado,
        material: form.material,
        material_precio_m2: Number(form.material_precio_m2) || 0,
        tipo_cambio: Number(form.tipo_cambio) || 1000,
        color_tipo: form.color_tipo,
        espesor: form.espesor,
        acabado: form.acabado,
        bacha: form.bacha,
        anafe: form.anafe,
        croquis: form.croquis,
        observaciones_diseno: form.observaciones_diseno,
        detalles_fabricacion: form.detalles_fabricacion,
        pileta_id: form.pileta_id ? Number(form.pileta_id) : undefined,
        pileta_precio: Number(form.pileta_precio) || 0,
        pileta_moneda: form.pileta_moneda || 'ARS',
        pileta_imagen: form.pileta_imagen,
        subtotal: Number(form.subtotal),
        traslado: Number(form.traslado),
        total: Number(form.total),
        sena_recibida: Number(form.sena_recibida),
        saldo_pendiente: Number(form.saldo_pendiente),
        dolar_dia: Number(form.dolar_dia),
        subtotal_usd: Number(form.subtotal_usd),
        traslado_usd: Number(form.traslado_usd),
        total_usd: Number(form.total_usd),
        sena_usd: Number(form.sena_usd),
        saldo_pendiente_usd: Number(form.saldo_pendiente_usd),
        forma_pago: form.forma_pago,
        saldo_pagado: form.saldo_pagado || false,
        fecha_pago_saldo: form.fecha_pago_saldo || null,
        fecha_entrega: form.fecha_entrega ? new Date(form.fecha_entrega).toISOString() : null,
        firma_cliente: form.firma_cliente,
        fecha_aprobacion: form.fecha_aprobacion ? new Date(form.fecha_aprobacion).toISOString() : null,
        observaciones: form.observaciones,
        observaciones_importantes: form.observaciones_importantes,
      };
      if (isEdit) {
        await updateOrden(id, payload);
      } else {
        await createOrden(payload);
      }

      navigate('/ordenes');
    } catch (err) {
      alert('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    await deleteOrden(id);
    navigate('/ordenes');
  };

  const handlePrint = () => window.print();

  const materialesAgrupados = materiales.filter((m) => m.nombre);

  if (loading) return <Loading />;

  const readOnly = ['EN EL TALLER', 'ENTREGADO'].includes(form.estado);

  return (
    <div className="orden-form">
      {/* ===== HEADER ===== */}
      <div className="orden-header" style={{ position: 'relative', overflow: 'hidden' }}>
        {logoUrl && (
          <div style={{
            position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
            opacity: 0.10, pointerEvents: 'none', zIndex: 0,
          }}>
            <img src={logoUrl} alt="Logo AFAMAR" style={{ height: 90, width: 'auto', objectFit: 'contain' }} />
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 22, fontWeight: 700 }}>Orden N° {form.numero || 'A-_____'}</span>
            {!['EN MEDICIÓN'].includes(form.estado) && (
              <span className={badgeClass(form.estado)} style={{ fontSize: 13, padding: '4px 14px' }}>{form.estado}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Eye size={16} /> VISTA PREVIA PDF
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving} style={{ background: '#b91c1c', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px' }}>
            <Save size={16} /> {saving ? 'GUARDANDO...' : 'GUARDAR'}
          </button>
          <button className="btn btn-outline" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Printer size={16} /> IMPRIMIR
          </button>
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button className="btn btn-outline" onClick={() => setMenuOpen(!menuOpen)} style={{ padding: '8px 10px' }}>
              <MoreVertical size={18} />
            </button>
            {menuOpen && (
              <div className="dropdown-menu">
                <div className="dropdown-item" onClick={() => { setMenuOpen(false); alert('Duplicar orden'); }}>
                  <Copy size={16} /> Duplicar
                </div>
                <div className="dropdown-item" onClick={() => { setMenuOpen(false); alert('Exportar PDF'); }}>
                  <FileDown size={16} /> Exportar PDF
                </div>
                <div className="dropdown-item" style={{ color: '#ef4444' }} onClick={() => { setMenuOpen(false); setDeleteConfirm(true); }}>
                  <Trash2 size={16} /> Eliminar
                </div>
                <div className="dropdown-item" onClick={() => { setMenuOpen(false); alert('Historial de cambios'); }}>
                  <History size={16} /> Historial
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); }}>
        {/* ===== DATOS DEL CLIENTE ===== */}
        <div className="card" style={{ marginTop: 16 }}>
          <div className="orden-grid-4">
            <div className="form-group">
              <label>Fecha</label>
              <input type="date" className="input" value={form.fecha} onChange={(e) => update('fecha', e.target.value)} disabled={readOnly} />
            </div>
            <div className="form-group" style={{ position: 'relative' }} ref={clienteRef}>
              <label>Cliente</label>
              <input className="input" value={form.cliente_nombre} onChange={(e) => { update('cliente_nombre', e.target.value); setShowClienteDropdown(true); }} onFocus={() => setShowClienteDropdown(true)} placeholder="Nombre del cliente" disabled={readOnly} />
              {showClienteDropdown && clientesFiltrados.length > 0 && form.cliente_nombre && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                  {clientesFiltrados.map((c) => (
                    <div key={c.id} onClick={() => handleClienteSelect(c)} style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ fontWeight: 600 }}>{c.nombre}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>{c.telefono} {c.email ? `| ${c.email}` : ''}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Teléfono</label>
              <input className="input" value={form.cliente_telefono_orden} onChange={(e) => update('cliente_telefono_orden', e.target.value)} placeholder="Teléfono" disabled={readOnly} />
            </div>
            <div className="form-group">
              <label>E-mail</label>
              <input className="input" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="Email" disabled={readOnly} />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: 8 }}>
            <label>Domicilio</label>
            <input className="input" value={form.domicilio} onChange={(e) => update('domicilio', e.target.value)} placeholder="Calle N° - Ciudad - Provincia" disabled={readOnly} />
          </div>
        </div>

        {/* ===== ÁREA CENTRAL: Croquis 70% | Materiales 30% ===== */}
        <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
          <div style={{ flex: 7, minWidth: 0 }}>
            <CroquisEditor croquis={form.croquis} onChange={(v) => update('croquis', v)} readOnly={readOnly} />
          </div>
          <div style={{ flex: 3, minWidth: 0 }}>
            <div className="card" style={{ height: '100%' }}>
              <h3 className="section-title">MATERIALES</h3>
              <div className="form-group">
                <label>Material</label>
                <select className="input" value={form.material} onChange={(e) => handleMaterialChange(e.target.value)} disabled={readOnly}>
                  <option value="">Seleccionar...</option>
                  {materialesAgrupados.map((m) => (
                    <option key={m.id} value={m.nombre}>
                      {m.nombre}{m.color ? ` - ${m.color}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Color / Tipo</label>
                <input className="input" value={form.color_tipo} onChange={(e) => update('color_tipo', e.target.value)} placeholder="Ej: Negro Brasil" disabled={readOnly} />
              </div>
              <div className="form-row" style={{ gap: 8 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Espesor</label>
                  <select className="input" value={form.espesor} onChange={(e) => update('espesor', e.target.value)} disabled={readOnly || !!form.material}>
                    {espesores.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Acabado</label>
                  <select className="input" value={form.acabado} onChange={(e) => update('acabado', e.target.value)} disabled={readOnly}>
                    {acabados.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>
              {form.material && materiales.length > 0 && (() => {
                const mat = materiales.find((m) => m.nombre === form.material);
                if (!mat) return null;
                const precioArs = mat.precio_m2 || 0;
                const precioUsd = mat.precio_m2_usd || 0;
                return (
                <div style={{ marginTop: 8, padding: 10, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                    <span>Categoría:</span>
                    <span style={{ fontWeight: 600 }}>{mat.categoria || '-'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: '#64748b' }}>Precio ARS:</span>
                    <span style={{ fontWeight: 700, color: '#059669' }}>${Number(precioArs).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: '#64748b' }}>Precio USD:</span>
                    <span style={{ fontWeight: 700, color: '#059669' }}>
                      U$S {Number(precioUsd).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#94a3b8' }}>
                    <span>Moneda base:</span>
                    <span style={{ fontWeight: 600 }}>{mat.moneda === 'ARS' ? 'ARS (Pesos)' : 'USD (Dólares)'}</span>
                  </div>
                </div>
                );
              })()}
              <div className="form-group">
                <label>Observaciones del diseño</label>
                <textarea className="input" rows={4} value={form.observaciones_diseno} onChange={(e) => update('observaciones_diseno', e.target.value)} placeholder="Zócalo de 7 cm. Frente de 4 cm. Incluye 3 perforaciones..." disabled={readOnly} />
              </div>
            </div>
          </div>
        </div>

        {/* ===== SECCIÓN INFERIOR: 4 paneles ===== */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          {/* Panel 1: Detalle de Fabricación y Adicionales */}
          <div className="card">
            <h3 className="section-title">DETALLE DE FABRICACIÓN Y ADICIONALES</h3>
            <table className="table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Detalle</th>
                  <th style={{ width: 70 }}>Moneda</th>
                  <th style={{ width: 110 }}>Precio</th>
                  <th style={{ width: 30 }}></th>
                </tr>
              </thead>
              <tbody>
                {form.detalles_fabricacion.map((d, i) => (
                  <tr key={i}>
                    <td>
                      <select className="input" style={{ fontSize: 12, padding: '4px 8px' }} value={d.concepto} onChange={(e) => handleDetalleChange(i, 'concepto', e.target.value)} disabled={readOnly}>
                        {conceptosFabricacion.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td>
                      {CONCEPTOS_M2.includes(d.concepto) ? (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <input className="input" type="number" step="0.01" min="0" style={{ fontSize: 12, padding: '4px 8px', width: '30%' }} value={d.largo || ''} onChange={(e) => handleDetalleChange(i, 'largo', Number(e.target.value))} placeholder="Largo" disabled={readOnly} />
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>×</span>
                          <input className="input" type="number" step="0.01" min="0" style={{ fontSize: 12, padding: '4px 8px', width: '30%' }} value={d.ancho || ''} onChange={(e) => handleDetalleChange(i, 'ancho', Number(e.target.value))} placeholder="Ancho" disabled={readOnly} />
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#1e40af', whiteSpace: 'nowrap' }}>{d.m2 || 0} m²</span>
                        </div>
                      ) : d.concepto === 'OTRA' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <input className="input" style={{ fontSize: 12, padding: '4px 8px' }} value={d.detalle} onChange={(e) => handleDetalleChange(i, 'detalle', e.target.value)} placeholder="DETALLES" disabled={readOnly} />
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <input className="input" type="number" step="0.01" min="0" style={{ fontSize: 12, padding: '4px 8px', width: '35%' }} value={d.largo || ''} onChange={(e) => handleDetalleChange(i, 'largo', Number(e.target.value))} placeholder="Largo" disabled={readOnly} />
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>×</span>
                            <input className="input" type="number" step="0.01" min="0" style={{ fontSize: 12, padding: '4px 8px', width: '35%' }} value={d.mano_de_obra || ''} onChange={(e) => handleDetalleChange(i, 'mano_de_obra', Number(e.target.value))} placeholder="Mano de obra" disabled={readOnly} />
                          </div>
                        </div>
                      ) : (
                        <input className="input" style={{ fontSize: 12, padding: '4px 8px' }} value={d.detalle} onChange={(e) => handleDetalleChange(i, 'detalle', e.target.value)} placeholder="Cant / ML / cm" disabled={readOnly} />
                      )}
                    </td>
                    <td>
                      <select className="input" style={{ fontSize: 11, padding: '4px 4px', width: '100%' }}
                        value={d.moneda || 'ARS'}
                        onChange={(e) => handleDetalleChange(i, 'moneda', e.target.value)}
                        disabled={readOnly}>
                        <option value="ARS">ARS</option>
                        <option value="USD">USD</option>
                      </select>
                    </td>
                    <td>
                      {CONCEPTOS_M2.includes(d.concepto) ? (
                        <span style={{ fontSize: 12, fontWeight: 600, color: d.moneda === 'USD' ? '#059669' : '#1e293b' }}>{d.moneda === 'USD' ? 'USD ' : '$'}{Number(d.precio || 0).toLocaleString('es-AR')}</span>
                      ) : d.concepto === 'OTRA' ? (
                        <span style={{ fontSize: 12, fontWeight: 600, color: d.moneda === 'USD' ? '#059669' : '#1e293b' }}>{d.moneda === 'USD' ? 'USD ' : '$'}{Number(d.precio || 0).toLocaleString('es-AR')}</span>
                      ) : ['TRAFORO DE PILETA', 'TRAFORO DE ANAFE', 'TRAFORO DE APOYO'].includes(d.concepto) ? (
                        <input className="input" type="number" step="0.01" min="0" style={{ fontSize: 12, padding: '4px 8px', width: '100%' }} value={d.precio || ''} onChange={(e) => handleDetalleChange(i, 'precio', Number(e.target.value))} placeholder="0" disabled={readOnly} />
                      ) : (
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>-</span>
                      )}
                    </td>
                    <td>
                      <button type="button" className="btn btn-outline" style={{ padding: '2px 6px' }} onClick={() => removeDetalle(i)} disabled={readOnly}>
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                  {form.estado === 'EN MEDICIÓN' && CONCEPTOS_M2.includes(d.concepto) && form.detalles_presupuestados[i]
                    ? ((pres, real) => {
                        const dif = Math.round((real - pres) * 10000) / 10000;
                        return (
                          <tr key={'med_' + i} style={{ background: '#f0f9ff', fontSize: 11 }}>
                            <td colSpan={2} style={{ padding: '3px 8px', color: '#1e40af', fontWeight: 600 }}>
                              📐 Medición
                            </td>
                            <td style={{ padding: '3px 8px' }}></td>
                            <td style={{ padding: '3px 8px', textAlign: 'center' }}>
                              <span style={{ color: '#6b7280' }}>Orig: <strong>{pres.toFixed(4)}</strong></span>
                              <span style={{ margin: '0 6px', color: '#94a3b8' }}>|</span>
                              <span style={{ color: '#1e40af' }}>Real: <strong>{real.toFixed(4)}</strong></span>
                              <span style={{ margin: '0 6px', color: '#94a3b8' }}>|</span>
                              <span style={{ color: dif > 0 ? '#16a34a' : dif < 0 ? '#dc2626' : '#6b7280', fontWeight: 700 }}>
                                Δ {dif > 0 ? '+' : ''}{dif.toFixed(4)} m²
                              </span>
                            </td>
                            <td style={{ padding: '3px 8px' }}></td>
                          </tr>
                        );
                      })(Number(form.detalles_presupuestados[i].m2) || 0, d.m2 || 0)
                    : null
                  }
                ))}
              </tbody>
            </table>
            <button type="button" className="btn btn-outline" onClick={addDetalle} style={{ marginTop: 8, fontSize: 13, padding: '6px 14px' }} disabled={readOnly}>
              <Plus size={14} /> Agregar concepto
            </button>
          </div>

          {/* Panel 2: Pileta */}
          <div className="card">
            <h3 className="section-title">PILETA</h3>
            <div className="form-group">
              <label>Seleccionar pileta</label>
              <select className="input" value={form.pileta_id} onChange={(e) => {
                const pileta = piletas.find((p) => p.id === Number(e.target.value));
                update('pileta_id', e.target.value);
                if (pileta) {
                  const moneda = form.pileta_moneda || 'ARS';
                  update('pileta_precio', moneda === 'USD' ? (pileta.precio_usd || 0) : (pileta.precio || 0));
                } else {
                  update('pileta_precio', 0);
                }
              }} disabled={readOnly}>
                <option value="">Sin pileta</option>
                {piletas.map((p) => (
                  <option key={p.id} value={p.id}>{p.marca} - {p.modelo} (Stock: {p.cantidad})</option>
                ))}
              </select>
            </div>
            {form.pileta_id && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="form-group">
                  <label>Moneda</label>
                  <select className="input" style={{ width: 80, textAlign: 'center' }} value={form.pileta_moneda || 'ARS'} onChange={(e) => {
                    const moneda = e.target.value;
                    update('pileta_moneda', moneda);
                    const pileta = piletas.find((p) => p.id === Number(form.pileta_id));
                    if (pileta) {
                      update('pileta_precio', moneda === 'USD' ? (pileta.precio_usd || 0) : (pileta.precio || 0));
                    }
                  }} disabled={readOnly}>
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Precio</label>
                  <input type="number" step="0.01" className="input" style={{ width: 160, fontSize: 16, fontWeight: 700, color: form.pileta_moneda === 'USD' ? '#059669' : '#1e40af' }}
                    value={form.pileta_precio || ''}
                    onChange={(e) => update('pileta_precio', Number(e.target.value))}
                    disabled={readOnly} />
                </div>
              </div>
            )}
            {!readOnly && (
            <div className="form-group">
              <label>Imagen de la pileta</label>
              <label className="btn btn-outline" style={{ cursor: 'pointer', display: 'inline-flex' }}>
                <Upload size={16} /> {form.pileta_imagen ? 'Cambiar imagen' : 'Subir imagen'}
                <input type="file" accept="image/*" hidden onChange={handlePiletaImagen} />
              </label>
            </div>
            )}
            {form.pileta_imagen && (
              <div style={{ marginTop: 8, borderRadius: 8, overflow: 'hidden', maxHeight: 160 }}>
                <img src={form.pileta_imagen} alt="Pileta" style={{ width: '100%', height: 'auto', borderRadius: 8 }} />
              </div>
            )}
          </div>

          {/* Panel 3: Presupuesto */}
          <div className="card">
            <h3 className="section-title">PRESUPUESTO</h3>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {/* Columna ARS */}
              <div style={{ flex: '1 1 280px', fontSize: 13, lineHeight: 1.8 }}>
                <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: 6, marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, color: '#6b7280' }}>SUBTOTALES (ARS)</span>
                </div>
                <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: 8, marginBottom: 8 }}>
                  {(form.detalles_fabricacion || []).filter((d) => Number(d.precio) > 0).map((d, i) => {
                    const arsVal = d.moneda === 'USD' ? Math.round(Number(d.precio) * (Number(form.dolar_dia) || 1) * 100) / 100 : Number(d.precio);
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{d.concepto === 'OTRA' ? (d.detalle || 'OTRA') : d.concepto}{d.m2 > 0 ? ` (${d.m2} m²)` : ''}{d.largo > 0 && d.concepto === 'OTRA' ? ` (${d.largo} m)` : ''}</span>
                        <span style={{ fontWeight: 600 }}>{formatCurrency(arsVal)}</span>
                      </div>
                    );
                  })}
                  {Number(form.pileta_precio) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Pileta</span>
                      <span style={{ fontWeight: 600 }}>
                        {formatCurrency(form.pileta_moneda === 'USD' ? Math.round(Number(form.pileta_precio) * (Number(form.dolar_dia) || 1) * 100) / 100 : Number(form.pileta_precio))}
                      </span>
                    </div>
                  )}
                </div>
                <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ margin: 0, fontWeight: 600 }}>Traslado</label>
                  <input type="number" className="input" style={{ width: 130, textAlign: 'right' }}
                    value={form.traslado}
                    onChange={(e) => handleTrasladoChange(e.target.value, 'ars')}
                    disabled={readOnly} />
                </div>
                <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: 6, marginBottom: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>TOTAL ARS</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#dc2626' }}>{formatCurrency(form.total)}</span>
                  </div>
                </div>
                <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ margin: 0 }}>Seña recibida (ARS)</label>
                  <input type="number" className="input" style={{ width: 130, textAlign: 'right' }}
                    value={form.sena_recibida}
                    onChange={(e) => handleSenaChange(e.target.value, 'ars')}
                    disabled={readOnly} />
                </div>
                <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <label style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#1e40af' }}>DÓLAR DEL DÍA</label>
                  <input type="number" className="input" style={{ width: 130, textAlign: 'right', fontWeight: 700, color: '#1e40af', borderColor: '#93c5fd' }}
                    value={form.dolar_dia}
                    onChange={(e) => handleDolarDiaChange(e.target.value)}
                    disabled={readOnly} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <span style={{ fontWeight: 600 }}>Saldo pendiente ARS</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#1e40af' }}>{formatCurrency(form.saldo_pendiente)}</span>
                </div>
              </div>

              {/* Columna USD */}
              <div style={{ flex: '1 1 280px', fontSize: 13, lineHeight: 1.8 }}>
                <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: 6, marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, color: '#6b7280' }}>SUBTOTALES (USD)</span>
                </div>
                <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: 8, marginBottom: 8 }}>
                  {(form.detalles_fabricacion || []).filter((d) => Number(d.precio) > 0).map((d, i) => {
                    const dd = Number(form.dolar_dia) || 1;
                    const usdVal = d.moneda === 'ARS' ? Math.round((Number(d.precio) / dd) * 100) / 100 : Number(d.precio);
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{d.concepto === 'OTRA' ? (d.detalle || 'OTRA') : d.concepto}{d.m2 > 0 ? ` (${d.m2} m²)` : ''}</span>
                        <span style={{ fontWeight: 600 }}>USD {usdVal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    );
                  })}
                  {Number(form.pileta_precio) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Pileta</span>
                      <span style={{ fontWeight: 600 }}>
                        USD {(form.pileta_moneda === 'USD' ? Number(form.pileta_precio) : Math.round((Number(form.pileta_precio) / (Number(form.dolar_dia) || 1)) * 100) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
                <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ margin: 0, fontWeight: 600 }}>Traslado (USD)</label>
                  <input type="number" className="input" style={{ width: 130, textAlign: 'right' }}
                    value={form.traslado_usd}
                    onChange={(e) => handleTrasladoChange(e.target.value, 'usd')}
                    disabled={readOnly} />
                </div>
                <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: 6, marginBottom: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>TOTAL USD</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#059669' }}>
                      USD {form.total_usd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ margin: 0 }}>Seña recibida (USD)</label>
                  <input type="number" className="input" style={{ width: 130, textAlign: 'right' }}
                    value={form.sena_usd}
                    onChange={(e) => handleSenaChange(e.target.value, 'usd')}
                    disabled={readOnly} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <span style={{ fontWeight: 600 }}>Saldo pendiente USD</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#059669' }}>
                    USD {form.saldo_pendiente_usd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Estado de pago y forma de pago (ancho completo) */}
            <div style={{ marginTop: 12, borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
              <div style={{ marginTop: 12, padding: '10px 14px', background: form.saldo_pagado ? '#d1fae5' : '#fef9c3', borderRadius: 8, border: `1px solid ${form.saldo_pagado ? '#6ee7b7' : '#fde68a'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 13, color: form.saldo_pagado ? '#065f46' : '#92400e' }}>
                      {form.saldo_pagado ? '✓ Saldo cobrado' : '⏳ Saldo pendiente de cobro'}
                    </span>
                    {form.saldo_pagado && form.fecha_pago_saldo && (
                      <div style={{ fontSize: 11, color: '#065f46', marginTop: 2 }}>Fecha: {form.fecha_pago_saldo}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!id) return;
                      const nuevo = !form.saldo_pagado;
                      const hoy = new Date().toISOString().slice(0, 10);
                      const payload = {
                        saldo_pagado: nuevo,
                        fecha_pago_saldo: nuevo ? hoy : null,
                      };
                      if (nuevo) {
                        payload.sena_recibida = Number(form.total);
                        payload.saldo_pendiente = 0;
                        payload.sena_usd = Number(form.total_usd);
                        payload.saldo_pendiente_usd = 0;
                      }
                      await updateOrden(id, payload);
                      setForm((prev) => ({ ...prev, ...payload, fecha_pago_saldo: nuevo ? hoy : '' }));
                    }}
                    style={{
                      padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                      background: form.saldo_pagado ? '#ef4444' : '#059669', color: 'white',
                    }}
                    disabled={saving}
                  >
                    {form.saldo_pagado ? 'Deshacer' : '✓ Confirmar pago'}
                  </button>
                </div>
              </div>
              <div style={{ marginTop: 12, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>TOTAL ARS</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#dc2626' }}>{formatCurrency(form.total)}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>TOTAL USD</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#059669' }}>
                      USD {form.total_usd.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 8 }}>
                <label>Forma de pago</label>
                <input className="input" value={form.forma_pago} onChange={(e) => update('forma_pago', e.target.value)} placeholder="Ej: Efectivo / Transferencia" disabled={readOnly} />
              </div>
              <div className="form-group" style={{ marginTop: 8 }}>
                <label>Fecha de entrega estimada</label>
                <input type="date" className="input" value={form.fecha_entrega} onChange={(e) => update('fecha_entrega', e.target.value)} disabled={readOnly} />
              </div>
            </div>
          </div>

          {/* Panel 4: Aprobación */}
          <div className="card">
            <h3 className="section-title">APROBACIÓN DEL CLIENTE</h3>
            <p style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
              El cliente aprueba el diseño y presupuesto.
            </p>
            <FirmaCanvas
              value={form.firma_cliente}
              onChange={(v) => update('firma_cliente', v)}
              label="Firma del cliente"
              height={140}
              readOnly={readOnly}
            />
            <div className="form-group" style={{ marginTop: 8 }}>
              <label>Fecha de aprobación</label>
              <input type="date" className="input" value={form.fecha_aprobacion} onChange={(e) => update('fecha_aprobacion', e.target.value)} disabled={readOnly} />
            </div>
          </div>
        </div>

        {/* ===== OBSERVACIONES IMPORTANTES ===== */}
        <div className="card" style={{ marginTop: 16, background: '#f9fafb', border: '1px solid #b91c1c' }}>
          <h3 className="section-title" style={{ color: '#b91c1c' }}>OBSERVACIONES IMPORTANTES PARA EL CLIENTE</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, color: '#374151', marginBottom: 12 }}>
            <div>✓ No se realizan instalaciones.</div>
            <div>✓ No se realizan entregas con lluvia.</div>
            <div>✓ La descarga se realiza al pie del camión.</div>
            <div>✓ Debe haber personas para descargar.</div>
            <div>✓ El traslado lo realiza únicamente el fletero.</div>
          </div>
          <div className="form-group">
            <label style={{ fontWeight: 600 }}>Observaciones adicionales</label>
            <textarea className="input" rows={3} value={form.observaciones_importantes} onChange={(e) => update('observaciones_importantes', e.target.value)} placeholder="Agregar observaciones adicionales..." disabled={readOnly} />
          </div>
        </div>

        {/* ===== BOTONES FINALES ===== */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="btn btn-outline" onClick={() => navigate('/ordenes')}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ background: '#b91c1c' }}>
            <Save size={16} /> {saving ? 'GUARDANDO...' : 'GUARDAR'}
          </button>
        </div>
      </form>

      <ConfirmDialog isOpen={deleteConfirm} onClose={() => setDeleteConfirm(false)} onConfirm={handleDelete} title="Eliminar orden" message="¿Estás seguro de eliminar esta orden de trabajo?" />
    </div>
  );
}

