import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/http';
import type { EntityFormState, EntityServices, FormField, MaterialEnForm, PiletaEnForm } from '../types';
import type { Material } from '../types/material';
import type { StockPileta } from '../types/stockPileta';
import type { Cliente } from '../types/cliente';
import { useCalculosPresupuesto } from './useCalculosPresupuesto';

const CONCEPTOS_M2 = ['ZÓCALO', 'FRENTE'];

const TRAFORO_DETALLES: Record<string, string> = {
  'TRAFORO DE PILETA': 'APERTURA Y PEGADO DE PILETA',
  'TRAFORO DE ANAFE': 'APERTURA DE ANAFE',
  'TRAFORO DE PILETA DE APOYO': 'APERTURA PILETA DE APOYO',
};

const CONCEPTO_NORMALIZE: Record<string, string> = {
  'APERTURA + PEGADO PILETA': 'TRAFORO DE PILETA',
  'APERTURA Y PEGADO DE PILETA': 'TRAFORO DE PILETA',
  'APERTURA ANAFE': 'TRAFORO DE ANAFE',
  'APERTURA DE ANAFE': 'TRAFORO DE ANAFE',
  'APERTURA PILETA APOYO': 'TRAFORO DE PILETA DE APOYO',
  'APERTURA PILETA DE APOYO': 'TRAFORO DE PILETA DE APOYO',
};

const INITIAL_FORM: EntityFormState = {
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
  recargo_ars: 0,
  recargo_usd: 0,
  recargo_pct: 0,
};

export default function useEntityForm({
  entityType,
  services,
  defaultEstado,
  id,
  navigate,
  onLoaded,
}: {
  entityType: string;
  services: EntityServices;
  defaultEstado: string;
  id?: string;
  navigate: (path: string) => void;
  onLoaded?: (data: Record<string, unknown>) => void;
}) {
  const isEdit = !!id;

  const [form, setForm] = useState<EntityFormState>({ ...INITIAL_FORM, estado: defaultEstado });
  const [loading, setLoading] = useState<boolean>(isEdit);
  const [saving, setSaving] = useState<boolean>(false);
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [piletas, setPiletas] = useState<StockPileta[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [showClienteDropdown, setShowClienteDropdown] = useState<boolean>(false);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [deleteConfirm, setDeleteConfirm] = useState<boolean>(false);
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [showCroquis, setShowCroquis] = useState<boolean>(false);
  const [modoUSD, setModoUSD] = useState<boolean>(false);
  const toggleModoUSD = useCallback(() => setModoUSD((p: boolean) => !p), []);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const clienteRef = useRef<HTMLDivElement | null>(null);
  const materialPrecioRef = useRef<number>(0);
  const materialUsdRef = useRef<number>(0);

  const update = useCallback((field: FormField, value: unknown) => {
    setForm((prev: EntityFormState) => ({ ...prev, [field]: value } as EntityFormState));
  }, []);

  const readOnly = ['TALLER', 'TERMINADA', 'ENTREGADA', 'CONVERTIDO A OT', 'RECHAZADO'].includes(form.estado);
  const hayUSD = (form.materiales || []).some((m: MaterialEnForm) => m.moneda === 'USD');
  const hayAlternativas = (form.materiales || []).some((m: MaterialEnForm) => m.es_alternativa);
  const clientesFiltrados = clientes.filter((c: Cliente) =>
    (c.nombre || '').toLowerCase().includes((form.cliente_nombre || '').toLowerCase())
  );

  useCalculosPresupuesto(form, setForm);

  // === Carga inicial ===
  useEffect(() => {
    services.getMateriales({ limit: 500 }).then((res: Record<string, unknown>) => setMateriales(res.data as Material[]));
    services.getPiletas().then((res: Record<string, unknown>) => setPiletas(res.data as StockPileta[]));
    services.getClientes({ limit: 500 }).then((res: Record<string, unknown>) => setClientes(res.data as Cliente[]));
    api.get('/settings').then((res) => {
      const configs = (res as unknown as Record<string, unknown>).data as Record<string, unknown>;
      const logoValue = configs?.['company_logo'] || configs?.['logo'];
      if (logoValue && typeof logoValue === 'string') {
        const base = (api.defaults.baseURL || '').replace(/\/api\/v\d+$/, '').replace(/\/api$/, '');
        setLogoUrl(`${base}${logoValue.startsWith('/') ? '' : '/'}${logoValue}`);
      }
    }).catch(() => { /* ignore — logo is optional */ });
    if (id) {
      services.getById(id).then((res: Record<string, unknown>) => {
        const d = res.data as Record<string, unknown>;
        setForm({
          ...INITIAL_FORM,
          numero: (d.numero as string) || '',
          cliente_nombre: (d.cliente_nombre as string) || '',
          cliente_telefono_orden: (d.cliente_telefono_orden as string) || '',
          domicilio: (d.domicilio as string) || '',
          email: (d.email as string) || '',
          fecha: d.fecha ? (d.fecha as string).slice(0, 10) : new Date().toISOString().slice(0, 10),
          estado: (d.estado as string) || defaultEstado,
          material: (d.material as string) || '',
          material_precio_m2: (d.material_precio_m2 as number) || 0,
          tipo_cambio: (d.tipo_cambio as number) || 1,
          color_tipo: (d.color_tipo as string) || '',
          espesor: (d.espesor as string) || '',
          acabado: (d.acabado as string) || '',
          bacha: (d.bacha as string) || '',
          anafe: (d.anafe as string) || '',
          croquis: (d.croquis as unknown[]) || [],
          observaciones_diseno: (d.observaciones_diseno as string) || '',
          detalles_fabricacion: (d.detalles_fabricacion as Array<Record<string, unknown>>)?.length
            ? (d.detalles_fabricacion as Array<Record<string, unknown>>).map((df: Record<string, unknown>) => {
                const det = ((df.detalle as string) || '').toUpperCase();
                const conTexto = ((df.concepto as string) || '').toUpperCase();
                let concepto = (df.concepto as string) || '';
                let detalle = (df.detalle as string) || '';
                if (CONCEPTO_NORMALIZE[det] || CONCEPTO_NORMALIZE[conTexto]) {
                  const norm = CONCEPTO_NORMALIZE[det] || CONCEPTO_NORMALIZE[conTexto];
                  concepto = norm;
                  detalle = TRAFORO_DETALLES[norm] || det;
                } else if (CONCEPTO_NORMALIZE[conTexto]) {
                  concepto = CONCEPTO_NORMALIZE[conTexto];
                  detalle = TRAFORO_DETALLES[concepto] || det;
                }
                return { ...df, concepto, detalle, largo: (df.largo as number) ?? null, ancho: (df.ancho as number) ?? null, m2: (df.m2 as number) || 0, mano_de_obra: (df.mano_de_obra as number) ?? null, precio: (df.precio as number) || 0 };
              })
            : [],
          detalles_presupuestados: (d.detalles_presupuestados as Array<Record<string, unknown>>) || [],
          materiales: ((d.materiales as Array<Record<string, unknown>>) || []).map((m: Record<string, unknown>) => ({
            ...m,
            m2_presupuestado: (m.m2_presupuestado as number) || (Number(m.largo || 0) * Number(m.ancho || 0) * ((m.cantidad as number) || 1)),
          })),
          piletas: (d.piletas as Array<Record<string, unknown>>) || [],
          pileta_id: (d.pileta_id as string) || '',
          pileta_precio: (d.pileta_precio as number) || 0,
          pileta_moneda: (d.pileta_moneda as string) || 'ARS',
          pileta_imagen: (d.pileta_imagen as string) || '',
          subtotal: (d.subtotal as number) || 0,
          traslado: (d.traslado as number) || 0,
          total: (d.total as number) || 0,
          sena_recibida: (d.sena_recibida as number) || 0,
          sena_moneda: (d.sena_moneda as string) || 'ARS',
          saldo_pendiente: (d.saldo_pendiente as number) || 0,
          forma_pago: (d.forma_pago as string) || '',
          cuotas: (d.cuotas as number) || 1,
          saldo_pagado: (d.saldo_pagado as boolean) || false,
          fecha_pago_saldo: d.fecha_pago_saldo ? (d.fecha_pago_saldo as string).slice(0, 10) : '',
          dolar_dia: (d.dolar_dia as number) ?? 1000,
          subtotal_usd: (d.subtotal_usd as number) || 0,
          traslado_usd: (d.traslado_usd as number) || 0,
          total_usd: (d.total_usd as number) || 0,
          sena_usd: (d.sena_usd as number) || 0,
          saldo_pendiente_usd: (d.saldo_pendiente_usd as number) || 0,
          fecha_entrega: d.fecha_entrega ? (d.fecha_entrega as string).slice(0, 10) : '',
          firma_cliente: (d.firma_cliente as string) || null,
          fecha_aprobacion: d.fecha_aprobacion ? (d.fecha_aprobacion as string).slice(0, 10) : '',
          observaciones: (d.observaciones as string) || '',
          observaciones_importantes: (d.observaciones_importantes as string) || '',
          descuento_porcentaje: (d.descuento_porcentaje as number) ?? 0,
          descuento_monto_fijo: (d.descuento_monto_fijo as number) ?? 0,
        } as unknown as EntityFormState);
        onLoaded?.(d);
        setLoading(false);
      });
    }
  }, [id]);

  // Número automático
  useEffect(() => {
    if (!isEdit && services.getNextNumero) {
      services.getNextNumero().then((res: Record<string, unknown>) => {
        setForm((prev: EntityFormState) => ({ ...prev, numero: (res.data as Record<string, unknown>).numero as string }));
      }).catch(() => {});
    }
  }, [isEdit]);

  // Sincronizar materialPrecioRef
  useEffect(() => {
    if (isEdit && materiales.length > 0 && form.material) {
      const foundMat = materiales.find((mat: Material) => mat.nombre === form.material);
      if (foundMat) {
        materialUsdRef.current = foundMat.precio_m2_usd || 0;
      }
    }
  }, [materiales, isEdit, form.material]);

  // Cerrar menús al hacer click fuera
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (clienteRef.current && !clienteRef.current.contains(e.target as Node)) setShowClienteDropdown(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // === Handlers ===
  const handleMaterialChange = useCallback((nombre: string) => {
    const m = materiales.find((mat: Material) => mat.nombre === nombre);
    if (m) {
      const currency = m.moneda || 'ARS';
      const usdPrice = m.precio_m2_usd || 0;
      const arsPrice = m.precio_m2 || 0;
      materialUsdRef.current = usdPrice;
      setForm((prev: EntityFormState) => {
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
              return { ...d, moneda: currency as 'ARS' | 'USD', precio: Math.round(d.m2 * pm2 * 100) / 100 };
            }
            return { ...d, moneda: currency as 'ARS' | 'USD' };
          }),
        } as EntityFormState;
      });
    } else {
      materialUsdRef.current = 0;
      setForm((prev: EntityFormState) => ({ ...prev, material: nombre, material_precio_m2: 0 }));
    }
  }, [materiales]);

  const handleClienteSelect = useCallback((c: Record<string, unknown>) => {
    setForm((prev: EntityFormState) => ({
      ...prev,
      cliente_nombre: c.nombre as string,
      cliente_telefono_orden: (c.telefono as string) || '',
      email: (c.email as string) || '',
      domicilio: (c.direccion as string) || '',
    }));
    setShowClienteDropdown(false);
  }, []);

  const handlePiletaImagen = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev: ProgressEvent<FileReader>) => update('pileta_imagen', ev.target?.result);
    reader.readAsDataURL(file);
  }, [update]);

  const handleTrasladoChange = useCallback((value: string, source: 'ars' | 'usd') => {
    const dd = Number(form.dolar_dia);
    if (source === 'usd') {
      const usd = Number(value) || 0;
      const ars = Math.round(usd * dd * 100) / 100;
      setForm((prev: EntityFormState) => ({ ...prev, traslado_usd: usd, traslado: ars }));
    } else {
      const ars = Number(value) || 0;
      const usd = dd > 0 ? Math.round((ars / dd) * 100) / 100 : 0;
      setForm((prev: EntityFormState) => ({ ...prev, traslado: ars, traslado_usd: usd }));
    }
  }, [form.dolar_dia]);

  const handleSenaMonedaChange = useCallback((moneda: string) => {
    const current = Number(form.sena_recibida || form.sena_usd || 0);
    setForm((prev: EntityFormState) => ({
      ...prev,
      sena_moneda: moneda,
      sena_recibida: moneda === 'ARS' ? current : 0,
      sena_usd: moneda === 'USD' ? current : 0,
    }));
  }, [form.dolar_dia, form.sena_recibida, form.sena_usd]);

  const handleSenaMontoChange = useCallback((value: string) => {
    const val = Number(value) || 0;
    const moneda = form.sena_moneda || 'ARS';
    setForm((prev: EntityFormState) => ({
      ...prev,
      sena_recibida: moneda === 'ARS' ? val : 0,
      sena_usd: moneda === 'USD' ? val : 0,
    }));
  }, [form.sena_moneda]);

  const handleDolarDiaChange = useCallback((value: string) => {
    const dd = Number(value);
    const tr_usd = Number(form.traslado_usd) || 0;
    setForm((prev: EntityFormState) => ({
      ...prev,
      dolar_dia: dd,
      traslado: Math.round(tr_usd * dd * 100) / 100,
    }));
  }, [form.traslado_usd]);

  const handleDetalleChange = useCallback((idx: number, field: string, value: unknown) => {
    setForm((prev: EntityFormState) => {
      const list = [...prev.detalles_fabricacion];
      list[idx] = { ...list[idx], [field]: value } as typeof list[number];
      if (field === 'concepto' && value !== 'OTRA') {
        list[idx].concepto_personalizado = '';
      }
      if (field === 'concepto' && TRAFORO_DETALLES[value as string]) {
        list[idx].detalle = TRAFORO_DETALLES[value as string];
      }
      const d = list[idx];

      if (field === 'material') {
        const mat = materiales.find((m: Material) => m.nombre === value);
        if (mat) {
          list[idx].material = value as string;
          list[idx].moneda = mat.moneda || 'ARS';
          list[idx].material_precio_m2 = mat.moneda === 'USD' ? (mat.precio_m2_usd || 0) : (mat.precio_m2 || 0);
          if (CONCEPTOS_M2.includes(d.concepto) && d.m2 > 0) {
            list[idx].precio = Math.round(d.m2 * (list[idx].material_precio_m2 || 0) * 100) / 100;
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
          const mat = materiales.find((m: Material) => m.nombre === d.material);
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
      largo: null, ancho: null, m2: 0, mano_de_obra: null, cantidad: 1, moneda: 'ARS' as const, precio: 0,
    }]);
  }, [form.detalles_fabricacion, update]);

  const removeDetalle = useCallback((idx: number) => {
    if (form.detalles_fabricacion.length <= 1) return;
    update('detalles_fabricacion', form.detalles_fabricacion.filter((_: unknown, i: number) => i !== idx));
  }, [form.detalles_fabricacion, update]);

  const addMaterial = useCallback((nombre: string) => {
    if (!nombre) return;
    const mat = materiales.find((m: Material) => m.nombre === nombre);
    if (!mat) return;
    update('materiales', [...(form.materiales || []), {
      nombre: mat.nombre, categoria: mat.categoria || '', color: mat.color || '',
      precio_m2: mat.precio_m2 || 0, precio_m2_usd: mat.precio_m2_usd || 0,
      moneda: mat.moneda || 'ARS', cantidad: 1, m2_utilizados: 0, m2_presupuestado: 0,
      largo: 0, ancho: 0, es_alternativa: false,
    } as MaterialEnForm]);
  }, [materiales, form.materiales, update]);

  const removeMaterial = useCallback((idx: number) => {
    update('materiales', form.materiales.filter((_: unknown, i: number) => i !== idx));
  }, [form.materiales, update]);

  const updateMaterial = useCallback((idx: number, field: string, value: unknown) => {
    const list = [...form.materiales];
    (list[idx] as unknown as Record<string, unknown>)[field] = value;
    update('materiales', list);
  }, [form.materiales, update]);

  const addPileta = useCallback((pid: string) => {
    if (!pid) return;
    const pt = piletas.find((p: StockPileta) => p.id === Number(pid));
    if (!pt) return;
    update('piletas', [...(form.piletas || []), {
      pileta_id: pt.id, marca: pt.marca, modelo: pt.modelo,
      precio: pt.precio || 0, moneda: 'ARS' as const, imagen: '', cantidad: 1,
    } as PiletaEnForm]);
  }, [piletas, form.piletas, update]);

  const removePileta = useCallback((idx: number) => {
    update('piletas', form.piletas.filter((_: unknown, i: number) => i !== idx));
  }, [form.piletas, update]);

  const updatePileta = useCallback((idx: number, field: string, value: unknown) => {
    const list = [...form.piletas];
    (list[idx] as unknown as Record<string, unknown>)[field] = value;
    update('piletas', list);
  }, [form.piletas, update]);

  const buildPayload = useCallback((): Record<string, unknown> => ({
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
      ? form.croquis.map((pag: unknown) => {
          const p = pag as Record<string, unknown>;
          return {
            ...p,
            dibujo: ((p.dibujo || p.elementos) as Array<Record<string, unknown>> || []).map((el: Record<string, unknown>) => {
              const { seleccionado, ...rest } = el;
              return rest;
            }),
          };
        })
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

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
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
        await services.update(id as string, payload);
      } else {
        await services.create(payload);
      }
      navigate(services.listPath);
    } catch {
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

  const handleCambioEstadoAccion = useCallback(async (nuevoEstado: string) => {
    if (!id) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { estado: nuevoEstado };
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
      await services.update(id as string, payload);
      setForm((prev: EntityFormState) => ({ ...prev, ...payload, estado: nuevoEstado }));
    } catch {
      alert('Error al cambiar estado');
    } finally {
      setSaving(false);
    }
  }, [id, form.total, form.total_usd, form.forma_pago, services]);

  const handlePrint = useCallback(() => {
    if (id && services.getPdfUrl) {
      window.open(services.getPdfUrl(id), '_blank');
    } else {
      window.print();
    }
  }, [id, services]);

  return {
    form,
    loading,
    saving,
    materiales: materiales as unknown as Record<string, unknown>[],
    piletas: piletas as unknown as Record<string, unknown>[],
    clientes: clientes as unknown as Record<string, unknown>[],
    logoUrl,
    showClienteDropdown,
    menuOpen,
    deleteConfirm,
    showCroquis,
    modoUSD,
    toggleModoUSD,
    setModoUSD,
    readOnly,
    hayUSD,
    hayAlternativas,
    clientesFiltrados: clientesFiltrados as unknown[],
    isEdit,
    menuRef,
    clienteRef,
    materialPrecioRef,
    materialUsdRef,
    materialesAgrupados: materiales.filter((m: Material) => m.nombre) as unknown[],
    CONCEPTOS_M2,
    setForm,
    setLoading,
    setSaving,
    setMenuOpen,
    setDeleteConfirm,
    setShowClienteDropdown,
    setShowCroquis,
    update,
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
    buildPayload,
  };
}
