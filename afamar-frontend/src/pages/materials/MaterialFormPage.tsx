import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Camera, Trash2, FolderTree } from 'lucide-react';
import {
  getMaterial,
  createMaterial,
  updateMaterial,
  uploadMaterialPhoto,
  getMaterialCategories,
  primeMaterialCategoryMap,
  type MaterialCategory,
} from '@/api/resources/materials';
import { getSettings } from '@/api/resources/settings';
import { useNotify } from '../../context/NotificationContext';
import { useList } from '../../api/hooks';
import type { MaterialFormData, Material } from '../../types/material';
import Loading from '../../components/common/Loading';
import styles from './MaterialFormPage.module.css';

const s = styles as unknown as Record<string, string>;

const CATEGORIES_KEY = ['material-categories'] as const;

export default function MaterialForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const notify = useNotify();
  const isEdit = !!id;
  const [loadingMaterial, setLoadingMaterial] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [tipoCambio, setTipoCambio] = useState(1);
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
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Categories always come from the API. This keeps the form in sync with the
  // MaterialsCategoriesPage CRUD (create/edit/delete) without a hard refresh.
  // We also re-prime the helper name→id map on every load so mapMaterialToApi can
  // resolve the selected category back to a numeric id when persisting.
  const { items: categorias, loading: loadingCategories } = useList<MaterialCategory>(
    CATEGORIES_KEY,
    async () => {
      const res = await getMaterialCategories();
      // axios interceptor unwraps {success,data} envelope → res.data IS the array
      const list = (res.data as unknown as MaterialCategory[]) || [];
      // Keep the helper name→id map populated for createMaterial/updateMaterial resolution.
      await primeMaterialCategoryMap();
      return list;
    }
  );

  useEffect(() => {
    getSettings().then((res) => {
      const data = (res.data as Record<string, unknown>) || {};
      setTipoCambio(Number(data.tipo_cambio) || 1);
    }).catch(() => { /* optional */ });
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoadingMaterial(true);
    getMaterial(id).then((res) => {
      const d = res.data as Material;
      setForm({
        name: d.name || '',
        // Backend stores category_id (numeric). Keep it as a string in the form
        // so it matches the `<option value>` created from categories list.
        category_id: d.category_id ? String(d.category_id) : '',
        color: d.color || '',
        available_thickness: d.available_thickness || '',
        base_price: d.base_price || 0,
        price_usd: d.price_usd || 0,
        currency: d.currency || 'ARS',
        supplier: d.supplier || '',
        stock_available: d.stock_available || 0,
        notes: d.notes || '',
      });
      if (d.photo) setExistingFoto(d.photo);
      setLoadingMaterial(false);
    }).catch(() => setLoadingMaterial(false));
  }, [id]);

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

  const handleRemoveFoto = () => {
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setSelectedFile(null);
    setFotoPreview(null);
    if (fileRef.current) fileRef.current.value = '';
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
      let materialId: string | number;
      if (isEdit) {
        await updateMaterial(id as string, form as unknown as Record<string, unknown>);
        materialId = id as string;
      } else {
        const res = await createMaterial(form as unknown as Record<string, unknown>);
        materialId = (res.data as Material).id;
      }
      if (selectedFile) {
        await uploadMaterialPhoto(materialId, selectedFile);
      }
      navigate('/admin/materials');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: any } })?.response?.data?.detail
        ?? (err instanceof Error ? err.message : 'Error al guardar el material');
      notify(typeof detail === 'string' ? detail : JSON.stringify(detail), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loadingMaterial) return <Loading />;

  const displayUrl = fotoPreview || (existingFoto ? `/${existingFoto}` : null);

  return (
    <div className={s['material-form']}>
      <h1 className={s['material-form__title']}>{isEdit ? 'Editar Material' : 'Nuevo Material'}</h1>

      <form onSubmit={handleSubmit}>
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
                <small style={{ color: '#b45309', fontSize: 12, marginTop: 4, display: 'block' }}>
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

          <div className={s['material-form__photo']}>
            <label className={s['material-form__photo-label']}>Foto del Material</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFotoSelect}
            />
            <div className={s['material-form__photo-row']}>
              {displayUrl ? (
                <div className={s['material-form__photo-preview']}>
                  <img src={displayUrl} alt="Vista previa" className={s['material-form__photo-img']} />
                  <button type="button" onClick={handleRemoveFoto} className={s['material-form__photo-remove']}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ) : (
                <div className={s['material-form__photo-empty']}>
                  <Camera size={32} color="#94a3b8" />
                </div>
              )}
              <button type="button" className="btn btn-outline" onClick={() => fileRef.current?.click()}>
                <Camera size={16} /> {existingFoto || fotoPreview ? 'Cambiar Foto' : 'Seleccionar Foto'}
              </button>
            </div>
            {selectedFile && <p className={s['material-form__file-info']}>{selectedFile.name}</p>}
          </div>

          <div className={s['material-form__actions']}>
            <button type="button" className="btn btn-outline" onClick={() => navigate('/admin/materials')}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} /> {saving ? 'Guardando...' : (isEdit ? 'Actualizar' : 'Crear Material')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
