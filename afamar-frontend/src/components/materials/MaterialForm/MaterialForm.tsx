import React, { useState, useEffect } from 'react';
import { parseApiError } from '../../../utils/error';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  getMaterial,
  createMaterial,
  updateMaterial,
  uploadMaterialPhoto,
  getMaterialCategories,
  getMaterialColors,
  primeMaterialCategoryMap,
  type MaterialCategory,
} from '@/api/resources/materials';
import type { MaterialColor } from '../../../types/material';
import { getSettings } from '@/api/resources/settings';
import { useNotify } from '../../../context/NotificationContext';
import { useGet, useList } from '../../../api/hooks';
import type { MaterialFormData, Material } from '../../../types/material';
import { LoadingSpinner } from '../../ui/LoadingSpinner/LoadingSpinner';
import { FormActions } from '../../ui/FormActions/FormActions';
import { MaterialPhotoUploader } from '../MaterialPhotoUploader/MaterialPhotoUploader';
import {
  CATEGORIES_KEY,
  COLORS_KEY,
  SETTINGS_KEY,
  MATERIAL_KEY,
} from './MaterialForm.constants';
import { useMaterialPhoto } from './MaterialForm.usePhoto';
import { MaterialIdentityFields } from './MaterialForm.IdentityFields';
import { MaterialCommercialFields } from './MaterialForm.CommercialFields';
import { MaterialExtraFields } from './MaterialForm.ExtraFields';
import styles from './MaterialForm.module.css';

const s = styles as unknown as Record<string, string>;

interface MaterialFormProps {
  /** When provided, the form runs in edit mode and pre-fills from the API. */
  materialId?: number | string;
  /** Called after a successful save. */
  onSaved?: () => void;
  /** Called when the user cancels. Defaults to navigating back. */
  onCancel?: () => void;
}

/** Material create/edit form.
 *
 *  This file is the ORCHESTRATOR (see ADR 0009): the state, the queries and
 *  the submit flow live here while the UI is delegated to focused
 *  sub-components:
 *
 *   - `MaterialForm.IdentityFields.tsx`  — nombre / categoría / color / espesor.
 *   - `MaterialForm.CommercialFields.tsx` — precio M² / moneda / proveedor / stock.
 *   - `MaterialForm.ExtraFields.tsx`     — bacha integrada + observaciones.
 *   - `MaterialForm.usePhoto.ts`         — foto (selección / preview / borrado).
 *   - `MaterialForm.constants.ts`        — query keys.
 */
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
    color_id: '',
    available_thickness: '',
    base_price: 0,
    price_usd: 0,
    currency: 'ARS',
    supplier: '',
    stock_available: 0,
    allows_integrated_sink: true,
    notes: '',
  });

  const {
    selectedFile,
    fotoPreview,
    existingFoto,
    deletingPhoto,
    handleFotoSelect,
    handleRemoveFoto,
    setExistingFoto,
  } = useMaterialPhoto({ materialId, notify });

  const { items: categorias, loading: loadingCategories } = useList<MaterialCategory>(
    CATEGORIES_KEY,
    async () => {
      const res = await getMaterialCategories();
      const list = (res.data as unknown as MaterialCategory[]) || [];
      await primeMaterialCategoryMap();
      return list;
    }
  );

  const { items: colores, loading: loadingColors } = useList<MaterialColor>(
    COLORS_KEY,
    async () => {
      const res = await getMaterialColors();
      return (res.data as unknown as MaterialColor[]) || [];
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
      color_id: materialData.color_id ? String(materialData.color_id) : '',
      available_thickness: materialData.available_thickness || '',
      base_price: materialData.base_price || 0,
      price_usd: materialData.price_usd || 0,
      currency: materialData.currency || 'ARS',
      supplier: materialData.supplier || '',
      stock_available: materialData.stock_available || 0,
      allows_integrated_sink: materialData.allows_integrated_sink ?? true,
      notes: materialData.notes || '',
    });
    if (materialData.photo) setExistingFoto(materialData.photo);
  }, [materialData, setExistingFoto]);

  const patchForm = (patch: Partial<MaterialFormData>) => {
    setForm({ ...form, ...patch });
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
      const payload: Record<string, unknown> = {
        ...form,
        color_id: form.color_id === '' || form.color_id === undefined ? null : Number(form.color_id),
      };
      let materialIdResolved: string | number;
      if (isEdit) {
        await updateMaterial(materialId as string, payload);
        materialIdResolved = materialId as string;
      } else {
        const res = await createMaterial(payload);
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
        <MaterialIdentityFields
          form={{
            name: form.name,
            category_id: form.category_id,
            color_id: form.color_id,
            available_thickness: form.available_thickness,
          }}
          categorias={categorias}
          colores={colores}
          loadingCategories={loadingCategories}
          loadingColors={loadingColors}
          navigate={navigate}
          onChange={patchForm}
        />
        <MaterialCommercialFields
          form={{
            base_price: form.base_price,
            price_usd: form.price_usd,
            currency: form.currency,
            supplier: form.supplier,
            stock_available: form.stock_available,
          }}
          onChange={patchForm}
          onPrecioArsChange={handlePrecioArsChange}
          onPrecioUsdChange={handlePrecioUsdChange}
          onMonedaChange={handleMonedaChange}
        />
        <MaterialExtraFields
          allows_integrated_sink={form.allows_integrated_sink}
          notes={form.notes}
          onChange={patchForm}
        />

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
