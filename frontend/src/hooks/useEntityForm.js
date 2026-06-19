import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';

const CONCEPTOS_M2 = ['ZÓCALO', 'FRENTE'];

const TRAFORO_DETALLES = {
  'TRAFORO DE PILETA': 'APERTURA Y PEGADO DE PILETA',
  'TRAFORO DE ANAFE': 'APERTURA DE ANAFE',
  'TRAFORO DE PILETA DE APOYO': 'APERTURA PILETA DE APOYO',
};
const CONCEPTO_NORMALIZE = {
  'APERTURA + PEGADO PILETA': 'TRAFORO DE PILETA',
  'APERTURA Y PEGADO DE PILETA': 'TRAFORO DE PILETA',
  'APERTURA ANAFE': 'TRAFORO DE ANAFE',
  'APERTURA DE ANAFE': 'TRAFORO DE ANAFE',
  'APERTURA PILETA APOYO': 'TRAFORO DE PILETA DE APOYO',
  'APERTURA PILETA DE APOYO': 'TRAFORO DE PILETA DE APOYO',
};

const CONFIG_CUOTAS = {};
for (let i = 1; i <= 12; i++) CONFIG_CUOTAS[i] = i <= 2 ? 0 : i * 5;

const INITIAL_FORM = {
  numero: '',
  cliente_nombre: '', cliente_telefono_orden: '', domicilio: '', email: '',
  fecha: new Date().toISOString().slice(0, 10),
  estado: '',
  material: '', material_precio_m2: 0, color_tipo: '', espesor: '', acabado: '', tipo_cambio: 1,
  bacha: '', anafe: '',
  croquis: [],
  observaciones_diseno: '',
  detalles_fabricacion: [],
  pileta_id: '', pileta_imagen: '', pileta_precio: 0, pileta_moneda: 'ARS',
  subtotal: 0, traslado: 0, total: 0,
  sena_recibida: 0, sena_moneda: 'ARS', saldo_pendiente: 0, forma_pago: '', saldo_pagado: false, fecha_pago_saldo: '',
  dolar_dia: 1000,
  cuotas: 1,
  subtotal_usd: 0, traslado_usd: 0, total_usd: 0, sena_usd: 0, saldo_pendiente_usd: 0,
  fecha_entrega: '',
  firma_cliente: null, fecha_aprobacion: '',
  observaciones: '', observaciones_importantes: '',
  detalles_presupuestados: [],
  materiales: [],
  piletas: [],
  orden_trabajo_numero: null,
  descuento_porcentaje: 0,
  descuento_monto_fijo: 0,
};

export default function useEntityForm({
  entityType,
  services,
  defaultEstado,
  id,
  navigate,
  onLoaded,
}) {
  const isEdit = !!id;

  const [form, setForm] = useState({ ...INITIAL_FORM, estado: defaultEstado });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [materiales, setMateriales] = useState([]);
  const [piletas, setPiletas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [showCroquis, setShowCroquis] = useState(false);

  const menuRef = useRef(null);
  const clienteRef = useRef(null);
  const materialPrecioRef = useRef(0);
  const materialUsdRef = useRef(0);

  const update = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const readOnly = ['TALLER', 'TERMINADA', 'ENTREGADA', 'CONVERTIDO A OT', 'RECHAZADO'].includes(form.estado);
  const hayUSD = (form.materiales || []).some((m) => m.moneda === 'USD');
  const hayAlternativas = (form.materiales || []).some((m) => m.es_alternativa);
  const clientesFiltrados = clientes.filter((c) =>
    c.nombre?.toLowerCase().includes((form.cliente_nombre || '').toLowerCase())
  );

  // === Carga inicial ===
  useEffect(() => {
    services.getMateriales({ limit: 500 }).then((res) => setMateriales(res.data));
    services.getPiletas().then((res) => setPiletas(res.data));
    services.getClientes({ limit: 500 }).then((res) => setClientes(res.data));
    api.get('/configuracion').then((res) => {
      const logo = res.data.find((c) => c.key === 'logo');
      if (logo?.value) {
        const base = (api.defaults.baseURL || 'http://localhost:8000/api').replace('/api', '');
        setLogoUrl(`${base}/${logo.value}`);
      }
    });
    if (id) {
      services.getById(id).then((res) => {
        const d = res.data;
        setForm({
          ...INITIAL_FORM,
          numero: d.numero || '',
          cliente_nombre: d.cliente_nombre || '',
          cliente_telefono_orden: d.cliente_telefono_orden || '',
          domicilio: d.domicilio || '',
          email: d.email || '',
          fecha: d.fecha ? d.fecha.slice(0, 10) : new Date().toISOString().slice(0, 10),
          estado: d.estado || defaultEstado,
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
          detalles_fabricacion: d.detalles_fabricacion?.length
            ? d.detalles_fabricacion.map((df) => {
                const det = (df.detalle || '').toUpperCase();
                const conTexto = (df.concepto || '').toUpperCase();
                let concepto = df.concepto || '';
                let detalle = df.detalle || '';
                if (CONCEPTO_NORMALIZE[det] || CONCEPTO_NORMALIZE[conTexto]) {
                  const norm = CONCEPTO_NORMALIZE[det] || CONCEPTO_NORMALIZE[conTexto];
                  concepto = norm;
                  detalle = TRAFORO_DETALLES[norm] || det;
                } else if (CONCEPTO_NORMALIZE[conTexto]) {
                  concepto = CONCEPTO_NORMALIZE[conTexto];
                  detalle = TRAFORO_DETALLES[concepto] || det;
                }
                return { ...df, concepto, detalle, largo: df.largo ?? null, ancho: df.ancho ?? null, m2: df.m2 || 0, mano_de_obra: df.mano_de_obra ?? null, precio: df.precio || 0 };
              })
            : [],
          detalles_presupuestados: d.detalles_presupuestados || [],
          materiales: (d.materiales || []).map((m) => ({
            ...m,
            m2_presupuestado: m.m2_presupuestado || (Number(m.largo || 0) * Number(m.ancho || 0) * (m.cantidad || 1)),
          })),
          piletas: d.piletas || [],
          pileta_id: d.pileta_id || '',
          pileta_precio: d.pileta_precio || 0,
          pileta_moneda: d.pileta_moneda || 'ARS',
          pileta_imagen: d.pileta_imagen || '',
          subtotal: d.subtotal || 0,
          traslado: d.traslado || 0,
          total: d.total || 0,
          sena_recibida: d.sena_recibida || 0,
          sena_moneda: d.sena_moneda || 'ARS',
          saldo_pendiente: d.saldo_pendiente || 0,
          forma_pago: d.forma_pago || '',
          cuotas: d.cuotas || 1,
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
          descuento_porcentaje: 0,
          descuento_monto_fijo: d.descuento || 0,
        });
        onLoaded?.(d);
        setLoading(false);
      });
    }
  }, [id]);

  // Número automático
  useEffect(() => {
    if (!isEdit && services.getNextNumero) {
      services.getNextNumero().then((res) => {
        setForm((prev) => ({ ...prev, numero: res.data.numero }));
      }).catch(() => {});
    }
  }, [isEdit]);

  // Sincronizar materialPrecioRef
  useEffect(() => {
    if (isEdit && materiales.length > 0 && form.material) {
      const foundMat = materiales.find((mat) => mat.nombre === form.material);
      if (foundMat) {
        materialUsdRef.current = foundMat.precio_m2_usd || 0;
      }
    }
  }, [materiales, isEdit, form.material]);

  // === Cálculo de totales ===
  useEffect(() => {
    materialPrecioRef.current = form.material_precio_m2;
    const arsTotal = (form.detalles_fabricacion || []).reduce(
      (sum, d) => sum + ((d.moneda === 'USD') ? 0 : (Number(d.precio) || 0) * (d.cantidad || 1)),
      0
    );
    const usdTotal = (form.detalles_fabricacion || []).reduce(
      (sum, d) => sum + ((d.moneda === 'USD') ? (Number(d.precio) || 0) * (d.cantidad || 1) : 0),
      0
    );
    const dd = Number(form.dolar_dia);
    const ppArs = (form.piletas || [])
      .filter((pt) => (pt.moneda || 'ARS') !== 'USD')
      .reduce((sum, pt) => sum + (pt.precio || 0) * (pt.cantidad || 1), 0);
    const ppUsd = (form.piletas || [])
      .filter((pt) => (pt.moneda || 'ARS') === 'USD')
      .reduce((sum, pt) => sum + (pt.precio || 0) * (pt.cantidad || 1), 0);
    const matsMain = (form.materiales || []).filter((m) => !m.es_alternativa);
    const matArs = matsMain
      .filter((m) => m.moneda !== 'USD')
      .reduce((sum, m) => sum + (Number(m.largo || 0) * Number(m.ancho || 0) * (m.cantidad || 1) * (m.precio_m2 || 0)), 0);
    const matUsd = matsMain
      .filter((m) => m.moneda === 'USD')
      .reduce((sum, m) => sum + (Number(m.largo || 0) * Number(m.ancho || 0) * (m.cantidad || 1) * (m.precio_m2_usd || 0)), 0);

    const pctRecargo = form.forma_pago === 'TARJETA DE CRÉDITO' ? (CONFIG_CUOTAS[form.cuotas] || 0) : 0;
    const subtotal = arsTotal + (dd > 0 ? Math.round((usdTotal + matUsd) * dd * 100) / 100 : 0) + matArs + ppArs + (dd > 0 ? Math.round(ppUsd * dd * 100) / 100 : 0);
    const tr = Number(form.traslado) || 0;
    const totalBase = Math.max(0, subtotal + tr);

    const descPct = Number(form.descuento_porcentaje) || 0;
    const descFijo = Number(form.descuento_monto_fijo) || 0;
    let totalConDescuento = totalBase;
    if (descPct > 0) {
      totalConDescuento = Math.round(totalBase * (1 - descPct / 100));
    } else if (descFijo > 0) {
      totalConDescuento = Math.max(0, totalBase - descFijo);
    }

    const recargoArs = Math.round(totalConDescuento * pctRecargo / 100);
    const total = totalConDescuento + recargoArs;

    const senaArs = Number(form.sena_recibida) || 0;
    const senaUsdVal = Number(form.sena_usd) || 0;
    const senaTotalArs = senaArs + (dd > 0 ? senaUsdVal * dd : 0);
    const senaTotalUsd = senaUsdVal + (dd > 0 ? senaArs / dd : 0);
    const saldo = Math.max(0, total - senaTotalArs);

    const tr_usd = Number(form.traslado_usd) || 0;
    const subtotal_usd = usdTotal + matUsd + ppUsd + (dd > 0 ? (arsTotal + matArs + ppArs) / dd : 0);
    const totalBaseUsd = Math.max(0, subtotal_usd + tr_usd);
    let totalConDescuentoUsd = totalBaseUsd;
    if (descPct > 0) {
      totalConDescuentoUsd = totalBaseUsd * (1 - descPct / 100);
    } else if (descFijo > 0 && dd > 0) {
      totalConDescuentoUsd = Math.max(0, totalBaseUsd - descFijo / dd);
    }
    const recargoUsd = Math.round(totalConDescuentoUsd * pctRecargo / 100);
    const total_usd = totalConDescuentoUsd + recargoUsd;
    const saldo_pendiente_usd = Math.max(0, total_usd - senaTotalUsd);

    const esComparativo = (form.materiales || []).some((m) => m.es_alternativa);
    const totalFinal = esComparativo ? 0 : total;
    const totalUsdFinal = esComparativo ? 0 : total_usd;
    const saldoFinal = esComparativo ? 0 : saldo;
    const saldoUsdFinal = esComparativo ? 0 : saldo_pendiente_usd;

    setForm((prev) => ({
      ...prev,
      subtotal,
      total: totalFinal,
      recargo_ars: recargoArs,
      recargo_usd: recargoUsd,
      recargo_pct: pctRecargo,
      saldo_pendiente: saldoFinal,
      subtotal_usd,
      total_usd: totalUsdFinal,
      saldo_pendiente_usd: saldoUsdFinal,
    }));
  }, [form.detalles_fabricacion, form.traslado, form.piletas, form.materiales,
      form.sena_moneda, form.sena_recibida, form.traslado_usd, form.sena_usd,
      form.dolar_dia, form.cuotas, form.forma_pago, form.descuento_porcentaje, form.descuento_monto_fijo]);

  // Cerrar menús al hacer click fuera
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
      if (clienteRef.current && !clienteRef.current.contains(e.target)) setShowClienteDropdown(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // === Handlers ===
  const handleMaterialChange = useCallback((nombre) => {
    const m = materiales.find((mat) => mat.nombre === nombre);
    if (m) {
      const currency = m.moneda || 'ARS';
      const usdPrice = m.precio_m2_usd || 0;
      const arsPrice = m.precio_m2 || 0;
      materialUsdRef.current = usdPrice;
      setForm((prev) => {
        const tc = prev.dolar_dia ?? 1000;
        const pm2 = currency === 'USD' ? Math.round(usdPrice * tc * 100) / 100 : arsPrice;
        materialPrecioRef.current = pm2;
        return {
          ...prev,
          material: nombre,
          color_tipo: m.color || '',
          espesor: m.espesor_disponible || '',
          material_precio_m2: pm2,
          detalles_fabricacion: (prev.detalles_fabricacion || []).map((d) => {
            if (CONCEPTOS_M2.includes(d.concepto) && d.m2 > 0) {
              return { ...d, moneda: currency, precio: Math.round(d.m2 * pm2 * 100) / 100 };
            }
            return { ...d, moneda: currency };
          }),
        };
      });
    } else {
      materialUsdRef.current = 0;
      setForm((prev) => ({ ...prev, material: nombre, material_precio_m2: 0 }));
    }
  }, [materiales]);

  const handleClienteSelect = useCallback((c) => {
    setForm((prev) => ({
      ...prev,
      cliente_nombre: c.nombre,
      cliente_telefono_orden: c.telefono || '',
      email: c.email || '',
      domicilio: c.direccion || '',
    }));
    setShowClienteDropdown(false);
  }, []);

  const handlePiletaImagen = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => update('pileta_imagen', ev.target.result);
    reader.readAsDataURL(file);
  }, [update]);

  const handleTrasladoChange = useCallback((value, source) => {
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
  }, [form.dolar_dia]);

  const handleSenaMonedaChange = useCallback((moneda) => {
    const current = Number(form.sena_recibida || form.sena_usd || 0);
    setForm((prev) => ({
      ...prev,
      sena_moneda: moneda,
      sena_recibida: moneda === 'ARS' ? current : 0,
      sena_usd: moneda === 'USD' ? current : 0,
    }));
  }, [form.dolar_dia, form.sena_recibida, form.sena_usd]);

  const handleSenaMontoChange = useCallback((value) => {
    const val = Number(value) || 0;
    const moneda = form.sena_moneda || 'ARS';
    setForm((prev) => ({
      ...prev,
      sena_recibida: moneda === 'ARS' ? val : 0,
      sena_usd: moneda === 'USD' ? val : 0,
    }));
  }, [form.sena_moneda]);

  const handleDolarDiaChange = useCallback((value) => {
    const dd = Number(value);
    const tr_usd = Number(form.traslado_usd) || 0;
    setForm((prev) => ({
      ...prev,
      dolar_dia: dd,
      traslado: Math.round(tr_usd * dd * 100) / 100,
    }));
  }, [form.traslado_usd]);

  const handleDetalleChange = useCallback((idx, field, value) => {
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

      if (field === 'material') {
        const mat = materiales.find((m) => m.nombre === value);
        if (mat) {
          list[idx].material = value;
          list[idx].moneda = mat.moneda || 'ARS';
          list[idx].material_precio_m2 = mat.moneda === 'USD' ? (mat.precio_m2_usd || 0) : (mat.precio_m2 || 0);
          if (CONCEPTOS_M2.includes(d.concepto) && d.m2 > 0) {
            list[idx].precio = Math.round(d.m2 * list[idx].material_precio_m2 * 100) / 100;
          }
        } else {
          list[idx].material = '';
          list[idx].material_precio_m2 = 0;
        }
      }

      if (d.concepto === 'OTRA' && (field === 'largo' || field === 'mano_de_obra')) {
        const largo = Number(d.largo) || 0;
        const mo = Number(d.mano_de_obra) || 0;
        list[idx].precio = Math.round(largo * mo * 100) / 100;
      } else if (CONCEPTOS_M2.includes(d.concepto) && (field === 'concepto' || field === 'largo' || field === 'ancho' || field === 'moneda' || field === 'material')) {
        const largo = Number(d.largo) || 0;
        const ancho = Number(d.ancho) || 0;
        const m2 = Math.round((largo * ancho) * 100000) / 100000;
        list[idx].m2 = m2;
        const moneda = d.moneda || 'ARS';
        let pm2 = 0;
        if (d.material) {
          const mat = materiales.find((m) => m.nombre === d.material);
          if (mat) {
            pm2 = moneda === 'USD' ? (mat.precio_m2_usd || 0) : (mat.precio_m2 || 0);
          }
        } else {
          pm2 = moneda === 'USD' ? (materialUsdRef.current || 0) : (Number(materialPrecioRef.current) || Number(prev.material_precio_m2) || 0);
        }
        list[idx].precio = Math.round(m2 * pm2 * 100) / 100;
      }
      return { ...prev, detalles_fabricacion: list };
    });
  }, [materiales]);

  const addDetalle = useCallback(() => {
    update('detalles_fabricacion', [...form.detalles_fabricacion, {
      concepto: 'ZÓCALO', detalle: '', material: '', material_precio_m2: 0,
      largo: null, ancho: null, m2: 0, mano_de_obra: null, cantidad: 1, moneda: 'ARS', precio: 0,
    }]);
  }, [form.detalles_fabricacion, update]);

  const removeDetalle = useCallback((idx) => {
    if (form.detalles_fabricacion.length <= 1) return;
    update('detalles_fabricacion', form.detalles_fabricacion.filter((_, i) => i !== idx));
  }, [form.detalles_fabricacion, update]);

  const addMaterial = useCallback((nombre) => {
    if (!nombre) return;
    const mat = materiales.find((m) => m.nombre === nombre);
    if (!mat) return;
    update('materiales', [...(form.materiales || []), {
      nombre: mat.nombre, categoria: mat.categoria || '', color: mat.color || '',
      precio_m2: mat.precio_m2 || 0, precio_m2_usd: mat.precio_m2_usd || 0,
      moneda: mat.moneda || 'ARS', cantidad: 1, m2_utilizados: 0, m2_presupuestado: 0,
      largo: 0, ancho: 0, es_alternativa: false,
    }]);
  }, [materiales, form.materiales, update]);

  const removeMaterial = useCallback((idx) => {
    update('materiales', form.materiales.filter((_, i) => i !== idx));
  }, [form.materiales, update]);

  const updateMaterial = useCallback((idx, field, value) => {
    const list = [...form.materiales];
    list[idx] = { ...list[idx], [field]: value };
    update('materiales', list);
  }, [form.materiales, update]);

  const addPileta = useCallback((pid) => {
    if (!pid) return;
    const pt = piletas.find((p) => p.id === Number(pid));
    if (!pt) return;
    update('piletas', [...(form.piletas || []), {
      pileta_id: pt.id, marca: pt.marca, modelo: pt.modelo,
      precio: pt.precio || 0, moneda: 'ARS', imagen: '', cantidad: 1,
    }]);
  }, [piletas, form.piletas, update]);

  const removePileta = useCallback((idx) => {
    update('piletas', form.piletas.filter((_, i) => i !== idx));
  }, [form.piletas, update]);

  const updatePileta = useCallback((idx, field, value) => {
    const list = [...form.piletas];
    list[idx] = { ...list[idx], [field]: value };
    update('piletas', list);
  }, [form.piletas, update]);

  const buildPayload = useCallback(() => ({
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
    croquis: Array.isArray(form.croquis)
      ? form.croquis.map((pag) => ({
          ...pag,
          dibujo: (pag.dibujo || pag.elementos || []).map((el) => {
            const { seleccionado, ...rest } = el;
            return rest;
          }),
        }))
      : form.croquis,
    observaciones_diseno: form.observaciones_diseno,
    detalles_fabricacion: form.detalles_fabricacion,
    materiales: form.materiales,
    pileta_id: form.pileta_id ? Number(form.pileta_id) : undefined,
    pileta_precio: Number(form.pileta_precio) || 0,
    pileta_moneda: form.pileta_moneda || 'ARS',
    pileta_imagen: form.pileta_imagen,
    piletas: form.piletas,
    subtotal: Number(form.subtotal),
    traslado: Number(form.traslado),
    total: Number(form.total),
    sena_recibida: Number(form.sena_recibida),
    sena_moneda: form.sena_moneda || 'ARS',
    saldo_pendiente: Number(form.saldo_pendiente),
    dolar_dia: Number(form.dolar_dia),
    subtotal_usd: Number(form.subtotal_usd),
    traslado_usd: Number(form.traslado_usd),
    total_usd: Number(form.total_usd),
    sena_usd: Number(form.sena_usd),
    saldo_pendiente_usd: Number(form.saldo_pendiente_usd),
    forma_pago: form.forma_pago,
    cuotas: form.cuotas || 1,
    saldo_pagado: form.saldo_pagado || false,
    fecha_pago_saldo: form.fecha_pago_saldo || null,
    fecha_entrega: form.fecha_entrega ? new Date(form.fecha_entrega).toISOString() : null,
    firma_cliente: form.firma_cliente,
    fecha_aprobacion: form.fecha_aprobacion ? new Date(form.fecha_aprobacion).toISOString() : null,
    observaciones: form.observaciones,
    observaciones_importantes: form.observaciones_importantes,
    descuento:
      Number(form.descuento_monto_fijo) > 0
        ? Number(form.descuento_monto_fijo)
        : Number(form.descuento_porcentaje) > 0
          ? Number(form.descuento_porcentaje)
          : 0,
    descuento_porcentaje: Number(form.descuento_porcentaje) || 0,
    descuento_monto_fijo: Number(form.descuento_monto_fijo) || 0,
  }), [form]);

  const handleSubmit = useCallback(async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const payload = buildPayload();
      if (['TARJETA DE CRÉDITO', 'TARJETA DE DÉBITO'].includes(form.forma_pago)) {
        payload.sena_recibida = Number(form.total);
        payload.saldo_pendiente = 0;
        payload.saldo_pagado = true;
        payload.sena_usd = Number(form.total_usd);
        payload.saldo_pendiente_usd = 0;
        payload.fecha_pago_saldo = new Date().toISOString().slice(0, 10);
      }
      if (isEdit) {
        await services.update(id, payload);
      } else {
        await services.create(payload);
      }
      navigate(services.listPath);
    } catch (err) {
      alert('Error al guardar');
    } finally {
      setSaving(false);
    }
  }, [isEdit, id, buildPayload, services, navigate, form.forma_pago, form.total, form.total_usd]);

  const handleDelete = useCallback(async () => {
    if (!id) return;
    await services.delete(id);
    navigate(services.listPath);
  }, [id, services, navigate]);

  const handleCambioEstadoAccion = useCallback(async (nuevoEstado) => {
    if (!id) return;
    setSaving(true);
    try {
      const payload = { estado: nuevoEstado };
      if (nuevoEstado === 'ENTREGADA') {
        payload.sena_recibida = Number(form.total);
        payload.sena_moneda = 'ARS';
        payload.saldo_pendiente = 0;
        payload.sena_usd = Number(form.total_usd);
        payload.saldo_pendiente_usd = 0;
        payload.saldo_pagado = true;
        payload.fecha_pago_saldo = new Date().toISOString().slice(0, 10);
      } else if (['TARJETA DE CRÉDITO', 'TARJETA DE DÉBITO'].includes(form.forma_pago)) {
        payload.sena_recibida = Number(form.total);
        payload.saldo_pendiente = 0;
        payload.saldo_pagado = true;
        payload.sena_usd = Number(form.total_usd);
        payload.saldo_pendiente_usd = 0;
        payload.fecha_pago_saldo = new Date().toISOString().slice(0, 10);
      }
      await services.update(id, payload);
      setForm((prev) => ({ ...prev, ...payload, estado: nuevoEstado }));
    } catch (err) {
      alert('Error al cambiar estado');
    } finally {
      setSaving(false);
    }
  }, [id, form.total, form.total_usd, form.forma_pago, services]);

  const handlePrint = useCallback(() => window.print(), []);

  return {
    // State
    form,
    loading,
    saving,
    materiales,
    piletas,
    clientes,
    logoUrl,
    showClienteDropdown,
    menuOpen,
    deleteConfirm,
    showCroquis,
    readOnly,
    hayUSD,
    hayAlternativas,
    clientesFiltrados,
    isEdit,
    menuRef,
    clienteRef,
    materialPrecioRef,
    materialUsdRef,
    materialesAgrupados: materiales.filter((m) => m.nombre),
    CONCEPTOS_M2,
    // Setters
    setForm,
    setLoading,
    setSaving,
    setMenuOpen,
    setDeleteConfirm,
    setShowClienteDropdown,
    setShowCroquis,
    update,
    // Handlers
    handleMaterialChange,
    handleClienteSelect,
    handlePiletaImagen,
    handleTrasladoChange,
    handleSenaMonedaChange,
    handleSenaMontoChange,
    handleDolarDiaChange,
    handleDetalleChange,
    addDetalle,
    removeDetalle,
    addMaterial,
    removeMaterial,
    updateMaterial,
    addPileta,
    removePileta,
    updatePileta,
    handleSubmit,
    handleDelete,
    handleCambioEstadoAccion,
    handlePrint,
    // Utils
    buildPayload,
  };
}
