// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/http';
import type { EntityFormState, EntityServices, FormField, MaterialInForm, PoolInForm } from '../types';
import type { Material } from '../types/material';
import type { Pool } from '../types/poolStock';
import type { Client } from '../types/client';
import { useBudgetCalculations } from './useBudgetCalculations';
import {
  INITIAL_FORM,
  M2_CONCEPTS,
  CUTOUT_DETAILS,
  buildPayload,
  mapApiToForm,
  addMaterialToList,
  addPoolToList,
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

  const [form, setForm] = useState<EntityFormState>({ ...INITIAL_FORM, status: defaultEstado });
  const [loading, setLoading] = useState<boolean>(isEdit);
  const [saving, setSaving] = useState<boolean>(false);
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [piletas, setPiletas] = useState<Pool[]>([]);
  const [clientes, setClients] = useState<Client[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState<boolean>(false);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [deleteConfirm, setDeleteConfirm] = useState<boolean>(false);
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [showCroquis, setShowCroquis] = useState<boolean>(false);
  const [modoUSD, setModoUSD] = useState<boolean>(false);
  const toggleModoUSD = useCallback(() => setModoUSD((p) => !p), []);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const clientRef = useRef<HTMLDivElement | null>(null);
  const materialPrecioRef = useRef<number>(0);
  const materialUsdRef = useRef<number>(0);

  const update = useCallback((field: FormField, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value } as EntityFormState));
  }, []);

  const readOnly = ['WORKSHOP', 'FINISHED', 'DELIVERED', 'CONVERTED_TO_OT', 'REJECTED'].includes(form.status);
  const hayUSD = ((form.materials_data as unknown as MaterialInForm[]) || []).some((m: MaterialInForm) => m.currency === 'USD');
  const hayAlternativas = ((form.materials_data as unknown as MaterialInForm[]) || []).some((m: MaterialInForm) => m.isAlternative);
  const filteredClients = clientes.filter((c) =>
    (c.name || '').toLowerCase().includes((form.client_name || '').toLowerCase())
  );

  useBudgetCalculations(form, setForm);

  useEffect(() => {
    services.getMaterials({ limit: 500 }).then((res: Record<string, unknown>) => setMateriales(res.data as Material[]));
    services.getPools().then((res: Record<string, unknown>) => setPiletas(res.data as Pool[]));
    services.getClients({ limit: 500 }).then((res: Record<string, unknown>) => setClients(res.data as Client[]));
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
        setForm((prev) => ({ ...prev, number: (res.data as Record<string, unknown>).number as string }));
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
      const foundMat = materiales.find((mat) => mat.name === form.material);
      if (foundMat) {
        materialUsdRef.current = foundMat.priceUsd || 0;
      }
    }
  }, [materiales, isEdit, form.material]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (clientRef.current && !clientRef.current.contains(e.target as Node)) setShowClientDropdown(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleMaterialChange = useCallback((name: string) => {
    const m = materiales.find((mat) => mat.name === name);
    if (m) {
      const currency = m.currency || 'ARS';
      const usdPrice = m.priceUsd || 0;
      const arsPrice = m.basePrice || 0;
      materialUsdRef.current = usdPrice;
      setForm((prev) => {
        const tc = prev.usd_rate ?? 1000;
        const pm2 = currency === 'USD' ? Math.round(usdPrice * tc * 100) / 100 : arsPrice;
        materialPrecioRef.current = pm2;
        return {
          ...prev,
          material: name,
          color: m.color || '',
          thickness: m.availableThickness || '',
          material_price_m2: pm2,
          fabrication_details: (prev.fabrication_details || []).map((d) => {
            if (M2_CONCEPTS.includes(d.concepto) && d.m2 > 0) {
              return { ...d, moneda: currency as 'ARS' | 'USD', precio: Math.round(d.m2 * pm2 * 100) / 100 };
            }
            return d;
          }),
        } as EntityFormState;
      });
    } else {
      materialUsdRef.current = 0;
      setForm((prev) => ({ ...prev, material: name, material_price_m2: 0 }));
    }
  }, [materiales]);

  const handleClientSelect = useCallback((c: Record<string, unknown>) => {
    setForm((prev) => ({
      ...prev,
      client_name: c.name as string,
      client_phone: (c.phone as string) || '',
      client_email: (c.email as string) || '',
      client_address: (c.address as string) || '',
    }));
    setShowClientDropdown(false);
  }, []);

  const handlePoolImage = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev: ProgressEvent<FileReader>) => update('pool_image', ev.target?.result as string);
    reader.readAsDataURL(file);
  }, [update]);

  const handleTransportChange = useCallback((value: string, source: 'ars' | 'usd') => {
    const dd = Number(form.usd_rate);
    if (source === 'usd') {
      const usd = Number(value) || 0;
      const ars = Math.round(usd * dd * 100) / 100;
      setForm((prev) => ({ ...prev, transport_usd: usd, transport: ars }));
    } else {
      const ars = Number(value) || 0;
      const usd = dd > 0 ? Math.round((ars / dd) * 100) / 100 : 0;
      setForm((prev) => ({ ...prev, transport: ars, transport_usd: usd }));
    }
  }, [form.usd_rate]);

  const handleDepositCurrencyChange = useCallback((currency: string) => {
    setForm((prev) => ({
      ...prev,
      deposit_currency: currency,
      deposit_received: currency === 'ARS' ? Number(prev.deposit_received) : 0,
      deposit_usd: currency === 'USD' ? Number(prev.deposit_usd) : 0,
    }));
  }, []);

  const handleDepositAmountChange = useCallback((value: string) => {
    const val = Number(value) || 0;
    const currency = form.deposit_currency || 'ARS';
    setForm((prev) => ({
      ...prev,
      deposit_received: currency === 'ARS' ? val : 0,
      deposit_usd: currency === 'USD' ? val : 0,
    }));
  }, [form.deposit_currency]);

  const handleUsdRateChange = useCallback((value: string) => {
    const dd = Number(value);
    const tr_usd = Number(form.transport_usd) || 0;
    setForm((prev) => ({
      ...prev,
      usd_rate: dd,
      transport: Math.round(tr_usd * dd * 100) / 100,
    }));
  }, [form.transport_usd]);

  const handleDetailChange = useCallback((idx: number, field: string, value: unknown) => {
    setForm((prev) => {
      const list = [...(prev.fabrication_details || [])];
      list[idx] = { ...list[idx], [field]: value } as typeof list[number];
      if (field === 'concepto' && value !== 'OTRA') {
        list[idx].concepto_personalizado = '';
      }
      if (field === 'concepto' && CUTOUT_DETAILS[value as string]) {
        list[idx].detalle = CUTOUT_DETAILS[value as string];
      }
      const d = list[idx];

      if (field === 'material') {
        const mat = materiales.find((m) => m.name === value);
        if (mat) {
          list[idx].material = value as string;
          list[idx].moneda = mat.currency || 'ARS';
          list[idx].material_precio_m2 = mat.currency === 'USD' ? (mat.priceUsd || 0) : (mat.basePrice || 0);
          if (M2_CONCEPTS.includes(d.concepto) && d.m2 > 0) {
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
      } else if (M2_CONCEPTS.includes(d.concepto) && (field === 'concepto' || field === 'largo' || field === 'ancho' || field === 'moneda' || field === 'material')) {
        const largo = Number(d.largo) || 0;
        const ancho = Number(d.ancho) || 0;
        const m2 = Math.round((largo * ancho) * 100000) / 100000;
        list[idx].m2 = m2;
        const moneda = d.moneda || 'ARS';
        let pm2 = 0;
        if (d.material) {
          const mat = materiales.find((m) => m.name === d.material);
          if (mat) {
            pm2 = moneda === 'USD' ? (mat.priceUsd || 0) : (mat.basePrice || 0);
          }
        } else {
          pm2 = moneda === 'USD' ? (materialUsdRef.current || 0) : (Number(materialPrecioRef.current) || Number(prev.material_price_m2) || 0);
        }
        list[idx].precio = Math.round(m2 * pm2 * 100) / 100;
      }
      return { ...prev, fabrication_details: list };
    });
  }, [materiales]);

  const addDetalle = useCallback(() => {
    update('fabrication_details', [...(form.fabrication_details || []), {
      concepto: 'ZÓCALO', detalle: '', material: '', material_precio_m2: 0,
      largo: null, ancho: null, m2: 0, mano_de_obra: null, cantidad: 1, moneda: 'ARS' as const, precio: 0,
    }]);
  }, [form.fabrication_details, update]);

  const removeDetalle = useCallback((idx: number) => {
    if (form.fabrication_details.length <= 1) return;
    update('fabrication_details', form.fabrication_details.filter((_, i) => i !== idx));
  }, [form.fabrication_details, update]);

  const addMaterial = useCallback((name: string) => {
    const list = addMaterialToList(form, materiales, name);
    if (list) update('materials_data', list);
  }, [form, materiales, update]);

  const removeMaterial = useCallback((idx: number) => {
    const list = (form.materials_data as unknown as MaterialInForm[]) || [];
    update('materials_data', list.filter((_, i) => i !== idx));
  }, [form.materials_data, update]);

  const updateMaterial = useCallback((idx: number, field: string, value: unknown) => {
    const list = [...(form.materials_data as unknown as MaterialInForm[])];
    (list[idx] as unknown as Record<string, unknown>)[field] = value;
    update('materials_data', list);
  }, [form.materials_data, update]);

  const addPileta = useCallback((pid: string) => {
    const list = addPoolToList(form, piletas, pid);
    if (list) update('pools_data', list);
  }, [form, piletas, update]);

  const removePileta = useCallback((idx: number) => {
    const list = (form.pools_data as unknown as PoolInForm[]) || [];
    update('pools_data', list.filter((_, i) => i !== idx));
  }, [form.pools_data, update]);

  const updatePileta = useCallback((idx: number, field: string, value: unknown) => {
    const list = [...(form.pools_data as unknown as PoolInForm[])];
    (list[idx] as unknown as Record<string, unknown>)[field] = value;
    update('pools_data', list);
  }, [form.pools_data, update]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const payload = buildPayload(form);
      if (['TARJETA DE CRÉDITO', 'TARJETA DE DÉBITO'].includes(form.payment_method)) {
        payload.deposit_received = Number(form.total);
        payload.balance_due = 0;
        payload.balance_paid = true;
        payload.deposit_usd = Number(form.total_usd);
        payload.balance_due_usd = 0;
        payload.balance_paid_at = new Date().toISOString().slice(0, 10);
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
  }, [id, services]);

  const handleStatusChangeAction = useCallback(async (newStatus: string) => {
    if (!id) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'ENTREGADA') {
        payload.deposit_received = Number(form.total);
        payload.deposit_currency = 'ARS';
        payload.balance_due = 0;
        payload.deposit_usd = Number(form.total_usd);
        payload.balance_due_usd = 0;
        payload.balance_paid = true;
        payload.balance_paid_at = new Date().toISOString().slice(0, 10);
      } else if (['TARJETA DE CRÉDITO', 'TARJETA DE DÉBITO'].includes(form.payment_method)) {
        payload.deposit_received = Number(form.total);
        payload.balance_due = 0;
        payload.balance_paid = true;
        payload.deposit_usd = Number(form.total_usd);
        payload.balance_due_usd = 0;
        payload.balance_paid_at = new Date().toISOString().slice(0, 10);
      }
      await services.update(id as string, payload);
      setForm((prev) => ({ ...prev, ...payload, status: newStatus }));
    } catch {
      alert('Error al cambiar estado');
    } finally {
      setSaving(false);
    }
  }, [id, form.total, form.total_usd, form.payment_method, services]);

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
    showClientDropdown, menuOpen, deleteConfirm, showCroquis,
    modoUSD, toggleModoUSD, setModoUSD,
    readOnly, hayUSD, hayAlternativas, filteredClients: filteredClients as unknown[],
    isEdit,
    menuRef, clientRef, materialPrecioRef, materialUsdRef,
    materialesAgrupados: materiales.filter((m) => m.name) as unknown[],
    M2_CONCEPTS,
    setForm, setLoading, setSaving,
    setMenuOpen, setDeleteConfirm, setShowClientDropdown, setShowCroquis,
    update,
    handleMaterialChange, handleClientSelect, handlePoolImage,
    handleTransportChange, handleDepositCurrencyChange, handleDepositAmountChange, handleUsdRateChange,
    handleDetailChange, addDetalle, removeDetalle,
    addMaterial, removeMaterial, updateMaterial,
    addPileta, removePileta, updatePileta,
    handleSubmit, handleDelete, handleStatusChangeAction, handlePrint,
    buildPayload: () => buildPayload(form),
  };
}
