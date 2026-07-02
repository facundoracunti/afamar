import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/http';
import type { EntityFormState, EntityServices, FormField, MaterialEnForm, PiletaEnForm } from '../types';
import type { Material } from '../types/material';
import type { StockPileta } from '../types/stockPileta';
import type { Cliente } from '../types/cliente';
import { useCalculosPresupuesto } from './useCalculosPresupuesto';
import {
  INITIAL_FORM,
  CONCEPTOS_M2,
  TRAFORO_DETALLES,
  buildPayload,
  mapApiToForm,
  addMaterialToList,
  addPiletaToList,
} from './entityFormHelpers';

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
  const toggleModoUSD = useCallback(() => setModoUSD((p) => !p), []);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const clienteRef = useRef<HTMLDivElement | null>(null);
  const materialPrecioRef = useRef<number>(0);
  const materialUsdRef = useRef<number>(0);

  const update = useCallback((field: FormField, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value } as EntityFormState));
  }, []);

  const readOnly = ['TALLER', 'TERMINADA', 'ENTREGADA', 'CONVERTIDO A OT', 'RECHAZADO'].includes(form.estado);
  const hayUSD = (form.materiales || []).some((m: MaterialEnForm) => m.moneda === 'USD');
  const hayAlternativas = (form.materiales || []).some((m: MaterialEnForm) => m.es_alternativa);
  const clientesFiltrados = clientes.filter((c) =>
    (c.nombre || '').toLowerCase().includes((form.cliente_nombre || '').toLowerCase())
  );

  useCalculosPresupuesto(form, setForm);

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
    }).catch(() => { /* logo is optional */ });

    if (!isEdit && services.getNextNumero) {
      services.getNextNumero().then((res: Record<string, unknown>) => {
        setForm((prev) => ({ ...prev, numero: (res.data as Record<string, unknown>).number as string }));
      }).catch(() => {});
    }
    if (id) {
      services.getById(id).then((res: Record<string, unknown>) => {
        const d = res.data as Record<string, unknown>;
        setForm(mapApiToForm(d, defaultEstado));
        onLoaded?.(d);
        setLoading(false);
      });
    }
  }, [id, isEdit]);

  useEffect(() => {
    if (isEdit && materiales.length > 0 && form.material) {
      const foundMat = materiales.find((mat) => mat.nombre === form.material);
      if (foundMat) {
        materialUsdRef.current = foundMat.precio_m2_usd || 0;
      }
    }
  }, [materiales, isEdit, form.material]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (clienteRef.current && !clienteRef.current.contains(e.target as Node)) setShowClienteDropdown(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleMaterialChange = useCallback((nombre: string) => {
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
              return { ...d, moneda: currency as 'ARS' | 'USD', precio: Math.round(d.m2 * pm2 * 100) / 100 };
            }
            return { ...d, moneda: currency as 'ARS' | 'USD' };
          }),
        } as EntityFormState;
      });
    } else {
      materialUsdRef.current = 0;
      setForm((prev) => ({ ...prev, material: nombre, material_precio_m2: 0 }));
    }
  }, [materiales]);

  const handleClienteSelect = useCallback((c: Record<string, unknown>) => {
    setForm((prev) => ({
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
      setForm((prev) => ({ ...prev, traslado_usd: usd, traslado: ars }));
    } else {
      const ars = Number(value) || 0;
      const usd = dd > 0 ? Math.round((ars / dd) * 100) / 100 : 0;
      setForm((prev) => ({ ...prev, traslado: ars, traslado_usd: usd }));
    }
  }, [form.dolar_dia]);

  const handleSenaMonedaChange = useCallback((moneda: string) => {
    const current = Number(form.sena_recibida || form.sena_usd || 0);
    setForm((prev) => ({
      ...prev,
      sena_moneda: moneda,
      sena_recibida: moneda === 'ARS' ? current : 0,
      sena_usd: moneda === 'USD' ? current : 0,
    }));
  }, [form.dolar_dia, form.sena_recibida, form.sena_usd]);

  const handleSenaMontoChange = useCallback((value: string) => {
    const val = Number(value) || 0;
    const moneda = form.sena_moneda || 'ARS';
    setForm((prev) => ({
      ...prev,
      sena_recibida: moneda === 'ARS' ? val : 0,
      sena_usd: moneda === 'USD' ? val : 0,
    }));
  }, [form.sena_moneda]);

  const handleDolarDiaChange = useCallback((value: string) => {
    const dd = Number(value);
    const tr_usd = Number(form.traslado_usd) || 0;
    setForm((prev) => ({
      ...prev,
      dolar_dia: dd,
      traslado: Math.round(tr_usd * dd * 100) / 100,
    }));
  }, [form.traslado_usd]);

  const handleDetalleChange = useCallback((idx: number, field: string, value: unknown) => {
    setForm((prev) => {
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
        const mat = materiales.find((m) => m.nombre === value);
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
      largo: null, ancho: null, m2: 0, mano_de_obra: null, cantidad: 1, moneda: 'ARS' as const, precio: 0,
    }]);
  }, [form.detalles_fabricacion, update]);

  const removeDetalle = useCallback((idx: number) => {
    if (form.detalles_fabricacion.length <= 1) return;
    update('detalles_fabricacion', form.detalles_fabricacion.filter((_, i) => i !== idx));
  }, [form.detalles_fabricacion, update]);

  const addMaterial = useCallback((nombre: string) => {
    const list = addMaterialToList(form, materiales, nombre);
    if (list) update('materiales', list);
  }, [form, materiales, update]);

  const removeMaterial = useCallback((idx: number) => {
    update('materiales', form.materiales.filter((_, i) => i !== idx));
  }, [form.materiales, update]);

  const updateMaterial = useCallback((idx: number, field: string, value: unknown) => {
    const list = [...form.materiales];
    (list[idx] as unknown as Record<string, unknown>)[field] = value;
    update('materiales', list);
  }, [form.materiales, update]);

  const addPileta = useCallback((pid: string) => {
    const list = addPiletaToList(form, piletas, pid);
    if (list) update('piletas', list);
  }, [form, piletas, update]);

  const removePileta = useCallback((idx: number) => {
    update('piletas', form.piletas.filter((_, i) => i !== idx));
  }, [form.piletas, update]);

  const updatePileta = useCallback((idx: number, field: string, value: unknown) => {
    const list = [...form.piletas];
    (list[idx] as unknown as Record<string, unknown>)[field] = value;
    update('piletas', list);
  }, [form.piletas, update]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const payload = buildPayload(form);
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
  }, [isEdit, id, services, navigate, form]);

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
      setForm((prev) => ({ ...prev, ...payload, estado: nuevoEstado }));
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
    form, loading, saving,
    materiales: materiales as unknown as Record<string, unknown>[],
    piletas: piletas as unknown as Record<string, unknown>[],
    clientes: clientes as unknown as Record<string, unknown>[],
    logoUrl,
    showClienteDropdown, menuOpen, deleteConfirm, showCroquis,
    modoUSD, toggleModoUSD, setModoUSD,
    readOnly, hayUSD, hayAlternativas, clientesFiltrados: clientesFiltrados as unknown[],
    isEdit,
    menuRef, clienteRef, materialPrecioRef, materialUsdRef,
    materialesAgrupados: materiales.filter((m) => m.nombre) as unknown[],
    CONCEPTOS_M2,
    setForm, setLoading, setSaving,
    setMenuOpen, setDeleteConfirm, setShowClienteDropdown, setShowCroquis,
    update,
    handleMaterialChange, handleClienteSelect, handlePiletaImagen,
    handleTrasladoChange, handleSenaMonedaChange, handleSenaMontoChange, handleDolarDiaChange,
    handleDetalleChange, addDetalle, removeDetalle,
    addMaterial, removeMaterial, updateMaterial,
    addPileta, removePileta, updatePileta,
    handleSubmit, handleDelete, handleCambioEstadoAccion, handlePrint,
    buildPayload: () => buildPayload(form),
  };
}
