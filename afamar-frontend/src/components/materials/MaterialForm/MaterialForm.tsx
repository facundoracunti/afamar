import React, { useState, useEffect } from 'react';
import { parseApiError } from '../../../utils/error';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { FolderTree } from 'lucide-react';
import {
  getMaterial,
  createMaterial,
  updateMaterial,
  uploadMaterialPhoto,
  deleteMaterialPhoto,
  getMaterialCategories,
  primeMaterialCategoryMap,
  type MaterialCategory,
} from '@/api/resources/materials';
import { getSettings } from '@/api/resources/settings';
import { useNotify } from '../../../context/NotificationContext';
import { useGet, useList } from '../../../api/hooks';
import type { MaterialFormData, Material } from '../../../types/material';
import { LoadingSpinner } from '../../ui/LoadingSpinner/LoadingSpinner';
import { FormActions } from '../../ui/FormActions/FormActions';
import { MaterialPhotoUploader } from '../MaterialPhotoUploader/MaterialPhotoUploader';
import styles from './MaterialForm.module.css';

const s = styles as unknown as Record<string, string>;

const CATEGORIES_KEY = ['material-categories'] as const;
const SETTINGS_KEY = ['settings'] as const;
const MATERIAL_KEY = (id: string | number | undefined) => ['material', id] as const;

interface MaterialFormProps {
  /** When provided, the form runs in edit mode and pre-fills from the API. */
  materialId?: number | string;
  /** Called after a successful save. */
  onSaved?: () => void;
  /** Called when the user cancels. Defaults to navigating back. */
  onCancel?: () => void;
}

export default function MaterialForm({ materialId, onSaved, onCancel }: MaterialFormProps) {
  const isEdit = materialId !== undefined;
  const navigate = useNavigate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const cancel = onCancel || (() => navigate(-1));

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<MaterialFormData>({
    name: '',
    category_id: '',
    color: '',
    available_thickness: '',
    base_price: 0,
    price_usd: 0,
    currency: 'ARS',
    supplier: '',
    stock_available: 0,
    notes: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [existingFoto, setExistingFoto] = useState<string | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState(false);

  const { items: categorias, loading: loadingCategories } = useList<MaterialCategory>(
    CATEGORIES_KEY,
    async () => {
      const res = await getMaterialCategories();
      const list = (res.data as unknown as MaterialCategory[]) || [];
      await primeMaterialCategoryMap();
      return list;
    }
  );

  // Settings (USD rate) — TanStack Query with 5min staleTime. Used as the
  // conversion factor between the ARS and USD price fields.
  const { data: settings } = useGet<Record<string, unknown>>(
    SETTINGS_KEY,
    async () => (await getSettings()).data as Record<string, unknown>,
    true,
  );
  const tipoCambio = Number(settings?.default_usd_rate) || 1000;

  // Material to edit (only when materialId is provided).
  const { data: materialData, loading: loadingMaterial } = useGet<Material>(
    MATERIAL_KEY(materialId),
    async () => {
      const res = await getMaterial(materialId as string);
      return res.data as Material;
    },
    !!materialId,
  );

  useEffect(() => {
    if (!materialData) return;
    setForm({
      name: materialData.name || '',
      category_id: materialData.category_id ? String(materialData.category_id) : '',
      color: materialData.color || '',
      available_thickness: materialData.available_thickness || '',
      base_price: materialData.base_price || 0,
      price_usd: materialData.price_usd || 0,
      currency: materialData.currency || 'ARS',
      supplier: materialData.supplier || '',
      stock_available: materialData.stock_available || 0,
      notes: materialData.notes || '',
    });
    if (materialData.photo) setExistingFoto(materialData.photo);
  }, [materialData]);

  useEffect(() => {
    return () => {
      if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    };
  }, [fotoPreview]);

  const handleFotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setSelectedFile(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  const handleRemoveFoto = async () => {
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setSelectedFile(null);
    setFotoPreview(null);
    if (materialId && existingFoto) {
      try {
        setDeletingPhoto(true);
        await deleteMaterialPhoto(materialId);
        setExistingFoto(null);
      } catch (err) {
        const detail = (err as { message?: string })?.message ?? 'No se pudo eliminar la foto';
        notify(detail, 'error');
      } finally {
        setDeletingPhoto(false);
      }
    } else {
      setExistingFoto(null);
    }
  };

  const handlePrecioArsChange = (value: number) => {
    const ars = Number(value) || 0;
    const usd = form.currency === 'ARS' ? (tipoCambio > 0 ? ars / tipoCambio : 0) : form.price_usd;
    setForm({ ...form, base_price: ars, price_usd: form.currency === 'ARS' ? usd : form.price_usd });
  };

  const handlePrecioUsdChange = (value: number) => {
    const usd = Number(value) || 0;
    const ars = form.currency === 'USD' ? (tipoCambio > 0 ? usd * tipoCambio : 0) : form.base_price;
    setForm({ ...form, price_usd: usd, base_price: form.currency === 'USD' ? ars : form.base_price });
  };

  const handleMonedaChange = (currency: string) => {
    const m = currency as 'ARS' | 'USD';
    if (m === 'ARS') {
      const usd = tipoCambio > 0 ? form.base_price / tipoCambio : 0;
      setForm({ ...form, currency: m, price_usd: usd });
    } else {
      const ars = tipoCambio > 0 ? form.price_usd * tipoCambio : 0;
      setForm({ ...form, currency: m, base_price: ars });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      notify('El nombre es obligatorio', 'error');
      return;
    }
    if (!form.category_id) {
      notify('Seleccioná una categoría', 'error');
      return;
    }
    setSaving(true);
    try {
      let materialIdResolved: string | number;
      if (isEdit) {
        await updateMaterial(materialId as string, form as unknown as Record<string, unknown>);
        materialIdResolved = materialId as string;
      } else {
        const res = await createMaterial(form as unknown as Record<string, unknown>);
        materialIdResolved = (res.data as Material).id;
      }
      if (selectedFile) {
        await uploadMaterialPhoto(materialIdResolved, selectedFile);
      }
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      queryClient.invalidateQueries({ queryKey: ['material-categories'] });
      if (onSaved) onSaved();
      else navigate('/admin/materials');
    } catch (err: unknown) {
      notify(parseApiError(err, 'Error al guardar el material'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loadingMaterial) return <LoadingSpinner />;

  return (
    <form onSubmit={handleSubmit} className={s['material-form']}>
      <div className={s['material-form__card']}>
        <div className={s['material-form__row']}>
          <div className={s['material-form__group']}>
            <label className={s['material-form__label']}>Nombre *</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className={s['material-form__group']}>
            <label className={s['material-form__label']}>
              Categoría *
              <a
                href="/admin/materials/categories"
                onClick={(e) => { e.preventDefault(); navigate('/admin/materials/categories'); }}
                className={s['material-form__label-link']}
                title="Gestionar categorías"
              >
                <FolderTree size={12} /> Gestionar
              </a>
            </label>
            <select
              className="input"
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              disabled={loadingCategories && categorias.length === 0}
              required
            >
              <option value="">{loadingCategories ? 'Cargando categorías...' : 'Seleccionar...'}</option>
              {categorias.map((c) => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
            {!loadingCategories && categorias.length === 0 && (
              <small className={s['material-form__warn-text']}>
                No hay categorías cargadas. Creá una desde "Gestionar Categorías" en el menú.
              </small>
            )}
          </div>
        </div>
        <div className={s['material-form__row']}>
          <div className={s['material-form__group']}>
            <label className={s['material-form__label']}>Color</label>
            <input className="input" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
          </div>
          <div className={s['material-form__group']}>
            <label className={s['material-form__label']}>Espesor disponible</label>
            <input className="input" value={form.available_thickness} onChange={(e) => setForm({ ...form, available_thickness: e.target.value })} />
          </div>
        </div>
        <div className={s['material-form__row']}>
          <div className={`${s['material-form__group']} ${s['material-form__group--grow']}`}>
            <label className={s['material-form__label']}>Precio M²</label>
            <input className="input" type="number" step="0.01" min="0"
              value={form.currency === 'USD' ? (form.price_usd || '') : (form.base_price || '')}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (form.currency === 'USD') handlePrecioUsdChange(v);
                else handlePrecioArsChange(v);
              }} />
          </div>
          <div className={`${s['material-form__group']} ${s['material-form__group--fixed']}`}>
            <label className={s['material-form__label']}>Moneda</label>
            <select className="input" value={form.currency} onChange={(e) => handleMonedaChange(e.target.value)}>
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>
        <div className={s['material-form__row']}>
          <div className={s['material-form__group']}>
            <label className={s['material-form__label']}>Proveedor</label>
            <input className="input" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
          </div>
          <div className={s['material-form__group']}>
            <label className={s['material-form__label']}>Stock disponible</label>
            <input className="input" type="number" min="0" value={form.stock_available} onChange={(e) => setForm({ ...form, stock_available: Number(e.target.value) })} />
          </div>
        </div>
        <div className={s['material-form__group']}>
          <label className={s['material-form__label']}>Observaciones</label>
          <textarea className="input" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>

        <MaterialPhotoUploader
          existingFoto={existingFoto}
          selectedFile={selectedFile}
          fotoPreview={fotoPreview}
          deletingPhoto={deletingPhoto}
          onSelect={handleFotoSelect}
          onRemove={handleRemoveFoto}
        />

        <FormActions
          loading={saving}
          submitLabel={isEdit ? 'Actualizar' : 'Crear Material'}
          onCancel={cancel}
        />
      </div>
    </form>
  );
}
